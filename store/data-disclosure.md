# Privacy practices: data usage

The Chrome Web Store counts data as "collected" when it leaves the device. What ForReal does:

| Mode | What leaves the computer |
|---|---|
| Automatic (default) and Rules only | Nothing. Rules and Chrome's on-device model run locally. |
| Advanced: own provider (opt-in, the reader's own key) | The text of posts near the screen (up to 6,000 characters), the author's display name and up to eight of the post's links go to the provider the reader chose (Anthropic, OpenRouter, or Ollama on the same computer), with the reader's API key. Nothing goes to the developer. |

## Answers for the dashboard (build with the Advanced engines, as in 0.3.0)

What user data do you plan to collect from users now or in the future?

| Category | Tick | Why |
|---|---|---|
| Personally identifiable information | no | |
| Health information | no | |
| Financial and payment information | no | |
| Authentication information | **yes** | Only in the opt-in Advanced mode: the reader's own API key is stored on the device and sent to the provider the reader chose, to authenticate the reader's requests. |
| Personal communications | no | |
| Location | no | |
| Web history | no | |
| User activity | no | |
| Website content | **yes** | Only in the opt-in Advanced mode: the text of feed posts is sent to the reader's chosen AI provider to word the verdict. |

Certifications (all true, tick all three):
- I do not sell or transfer user data to third parties, apart from the approved use cases.
  (Sending post text to the provider the reader chose, at the reader's request, is the feature itself.)
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## If the store build drops the Advanced engines

Then nothing leaves the computer: tick no category, keep the three certifications, and also remove the
`optional_host_permissions` from the manifest. (Not done in 0.3.0: it is the owner's call.)

## Firefox (AMO)

`build.py` declares `data_collection_permissions: required ["none"], optional ["websiteContent"]`, which matches the
table above.
