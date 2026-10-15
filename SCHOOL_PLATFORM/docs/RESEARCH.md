# Research basis (retrieved 27 September 2026)

Primary sources were preferred. These links should be rechecked during procurement and each major upgrade.

| Finding used in design | Primary source |
|---|---|
| Canvas source is AGPL-3.0 and the upstream repository is the learning engine | [Canvas LMS repository](https://github.com/instructure/canvas-lms), [licence](https://github.com/instructure/canvas-lms/blob/master/LICENSE) |
| List responses default to pagination and clients must follow opaque `Link` URLs | [Canvas pagination](https://developerdocs.instructure.com/services/canvas/basics/file.pagination) |
| API calls expose request cost and remaining quota for throttling | [Canvas throttling](https://developerdocs.instructure.com/services/canvas/basics/file.throttling) |
| Canvas accepts SIS CSV resources including users, courses, sections and enrolments; import APIs expose warnings/errors and batch/diff controls | [SIS CSV](https://developerdocs.instructure.com/services/canvas/sis/file.sis_csv), [SIS Imports API](https://developerdocs.instructure.com/services/canvas/resources/sis_imports) |
| LTI 1.3 registrations define OIDC initiation, launch URIs, keys, placements and narrowly scoped services | [LTI key configuration](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_dev_key_config.md), [LTI introduction](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.tools_intro.md) |
| Canvas supports account authentication-provider configuration | [Authentication Providers API](https://developerdocs.instructure.com/services/canvas/resources/authentication_providers) |
| Brand variables are exposed per account/context; InstUI is Canvas's React component library | [Brand Config API](https://developerdocs.instructure.com/services/canvas/resources/brand_configs), [InstUI](https://developerdocs.instructure.com/services/instui) |
| Canvas offers Live Events and Data Access Platform interfaces, which are integration/analytics surfaces rather than reasons to query transactional tables | [Live Events](https://developerdocs.instructure.com/services/canvas/data-services/live-events/overview/file.data_service_introduction.md), [DAP Query API](https://developerdocs.instructure.com/services/dap/query-api) |
| Child information and safeguards require explicit governance in South Africa | [POPIA Act 4 of 2013](https://www.justice.gov.za/legislation/acts/2013-004.pdf), [DBE POPIA guidelines](https://www.education.gov.za/Portals/0/Documents/Manuals/Guidelines%20for%20DBE%20POPIA.pdf?ver=2022-01-07-112100-680) |
| School fee rules include public-school exemption processes; therefore a simple “debt” flag is unsafe | [Government fee guidance](https://www.gov.za/faq/education/where-can-i-get-information-about-school-fees-and-no-fee-schools), [fee exemption regulations](https://www.gov.za/documents/notices/south-african-schools-act-regulations-exemption-payment-school-fees-public) |
| Accessibility target should be WCAG 2.2 AA | [W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) |

## Conclusions

- Rebuilding Canvas dashboards inside its source tree offers maximal control but creates a costly upgrade fork. Use supported theme controls for brand, a separate portal for administration, and LTI placements for course-context experiences. Patch upstream only where there is a proven accessibility or institutional blocker.
- Kubernetes is not automatically “institutional grade.” Operational maturity, tested recovery, monitoring and patch cadence matter more. Begin with the smallest topology that meets measured load and recovery objectives.
- Predictive early-warning models are premature before consent, data-quality analysis, baseline outcomes and fairness review. Start with transparent thresholds, record reasons, and require educator action/review.
- Fees require exemption, reversal, allocation, reconciliation and audit workflows—not a mutable balance field. The baseline therefore defers detailed fee code until policy and payment-provider discovery.

## Research limitation

The execution environment could fetch the repository and official documentation pages but could not reliably resolve the current GitHub release SHA through the API/remote endpoint. No version was invented. Production provisioning must resolve, review and pin an immutable upstream commit.
