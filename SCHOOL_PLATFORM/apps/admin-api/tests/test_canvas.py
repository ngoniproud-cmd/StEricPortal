import asyncio

import httpx

from app.canvas import CanvasClient


def test_canvas_follows_opaque_link_and_reads_cost():
    calls = []
    def handler(request: httpx.Request):
        calls.append(str(request.url))
        if len(calls) == 1:
            return httpx.Response(200, json=[{"id": 1}], headers={
                "Link": '<https://canvas.test/api/v1/courses?opaque=abc>; rel="next"',
                "X-Request-Cost": "1.25", "X-Rate-Limit-Remaining": "699.5"
            })
        return httpx.Response(200, json=[{"id": 2}])

    async def run():
        async with CanvasClient("https://canvas.test", "token", httpx.MockTransport(handler)) as canvas:
            result = await canvas.get_all("/api/v1/courses", {"per_page": 100})
            return result
    assert asyncio.run(run()) == [{"id": 1}, {"id": 2}]
    assert "opaque=abc" in calls[1]
