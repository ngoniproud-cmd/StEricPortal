# Permission model (draft for school approval)

| Action | Platform admin | Registrar | Finance | Teacher | Counsellor | Auditor |
|---|---:|---:|---:|---:|---:|---:|
| Configure infrastructure | ✓ |  |  |  |  | read evidence |
| Create/update learner identity | break-glass | ✓ |  |  |  | read audit |
| View assigned class roster |  | operational need |  | ✓ | case need | sampled |
| Edit course content/grades |  |  |  | assigned only |  | read evidence |
| View fee account |  | limited status | ✓ |  |  | sampled |
| Approve refund/write-off |  |  | separate approver |  |  | read audit |
| View safeguarding case |  |  |  | explicit case role only | explicit case role | exceptional |
| Export bulk personal data | approved only | approved only | approved finance only |  |  | approved sample |

“Platform admin” is not a universal data-reader role. Break-glass access needs reason, time limit and alert. API policies must also check school, term, section assignment, record sensitivity and purpose; role names alone are insufficient.
