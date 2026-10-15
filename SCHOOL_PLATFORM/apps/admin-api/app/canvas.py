import asyncio
from dataclasses import dataclass
import httpx


class CanvasError(RuntimeError):
    pass


@dataclass
class CanvasTelemetry:
    request_cost: float | None = None
    rate_remaining: float | None = None


class CanvasClient:
    def __init__(self, base_url: str, token: str, transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = base_url.rstrip("/") + "/"
        self.telemetry = CanvasTelemetry()
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=httpx.Timeout(20.0),
            transport=transport,
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self._client.aclose()

    async def request(self, method: str, url: str, *, retries: int = 3, **kwargs) -> httpx.Response:
        safe = method.upper() in {"GET", "HEAD", "OPTIONS", "PUT", "DELETE"}
        for attempt in range(retries + 1):
            response = await self._client.request(method, url, **kwargs)
            self._read_telemetry(response)
            if response.status_code not in {429, 502, 503, 504} or not safe or attempt == retries:
                break
            retry_after = min(float(response.headers.get("Retry-After", "0.5")), 10.0)
            await asyncio.sleep(retry_after * (2**attempt))
        if response.is_error:
            request_id = response.headers.get("X-Request-Context-Id", "unknown")
            raise CanvasError(f"Canvas {response.status_code}; request_context={request_id}")
        return response

    async def get_all(self, path: str, params: dict | None = None) -> list[dict]:
        url = path
        output: list[dict] = []
        first = True
        while url:
            response = await self.request("GET", url, params=params if first else None)
            first = False
            payload = response.json()
            if not isinstance(payload, list):
                raise CanvasError("Expected a list response from Canvas")
            output.extend(payload)
            url = response.links.get("next", {}).get("url")
        return output

    def _read_telemetry(self, response: httpx.Response) -> None:
        def number(name: str):
            try:
                return float(response.headers[name])
            except (KeyError, ValueError):
                return None
        self.telemetry.request_cost = number("X-Request-Cost")
        self.telemetry.rate_remaining = number("X-Rate-Limit-Remaining")
