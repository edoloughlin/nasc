---
id: task-055
title: Form elements should use ng-bind instead of name
status: To Do
assignee: []
created_date: '2025-10-13 16:43'
updated_date: '2025-10-13 17:04'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace reliance on input name attributes for binding and form payloads with an explicit ng-bind attribute on form controls.

Goals
- Inputs and form-associated elements (input/textarea/select) use ng-bind="path" for value binding and for payload key selection on na-submit.
- Preserve full support for absolute ($...) and dotted paths (e.g., $user.name) consistent with existing $-scope semantics.
- No backward compatibility: name="..." is ignored for binding and serialization (may surface validation error).
- Update SSR and validation to recognize ng-bind on inputs.

Rationale
- Eliminates dual sources of truth between name and binds.
- Makes form wiring consistent with display binds and $ scoping.
- Simplifies server handlers by unifying how keys are derived.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Inputs with ng-bind participate in form payloads (no name required)
- [x] #2 Support ng-bind with $ and dotted paths for inputs
- [x] #3 Validation overlay checks ng-bind on inputs against schema without false positives
- [ ] #4 Inputs with ng-bind participate in form payloads (no name required)
- [ ] #5 Support ng-bind with $ and dotted paths for inputs
- [x] #6 Remove support for name-based payload/value sync; ng-bind is the only source
- [x] #7 SSR fills inputs by ng-bind (incl. $/dotted); name attributes are ignored

- [x] #8 Validation flags use of name without ng-bind as an error with remediation hint
- [x] #9 Docs, demo, and migration updated; breaking change noted
- [x] #10 Tests added for $+ng-bind and removal of name path support; full suite passes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decide ng-bind semantics
2. Client: payloads from ng-bind
3. Client: value sync aliasing
4. SSR: fill by ng-bind
5. Validation: inputs use ng-bind
6. Tests: $ paths + SSR
7. Docs + migration update
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Client: inputs now sync and serialize via ng-bind; removed name-based handling
- SSR: fills inputs by ng-bind; no name support
- Validation: checks ng-bind on inputs; flags name without ng-bind
- Demo: migrated forms to ng-bind
- Docs: attributes reference updated (ng-bind for forms)
- Tests: updated for ng-bind + $ scopes; full suite passes
<!-- SECTION:NOTES:END -->
