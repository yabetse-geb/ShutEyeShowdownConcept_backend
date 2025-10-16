---
timestamp: 'Mon Oct 13 2025 15:33:39 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251013_153339.12fbfca0.md]]'
content_id: 94feed133a6a80e2ebdfab9bd682ef42fc42dc446319a088041e6bcd33d67060
---

# response:

To ensure concepts are independent in your concept design, follow these guidelines from the provided documentation:

1. **Single, User-Relevant Purpose:** Each concept must address a distinct user need. Avoid concepts with overly broad or overlapping purposes. For instance, the `Labeling` concept only handles associating labels, not the content of the items being labeled.
2. **Separate State and Concerns:** A concept manages *its own* state and does not directly access or modify the internal state of other concepts. Different concepts can hold different "views" or properties of a generic entity (like `User`), as seen with `UserAuthentication` and `UserProfile` both relating to `Users`.
3. **Generic Type Parameters (Polymorphism):** Concepts operate on generic type parameters (e.g., `User`, `Item`). They treat these as opaque identifiers, without assuming any specific properties or methods of the underlying concrete types. This prevents direct dependencies on the internal structure of data managed by other concepts.
4. **No Direct Code-Level Dependencies:** Crucially, your implementation should strictly avoid `import` statements or direct references between concept classes in code. Communication should be indirect, often through shared generic IDs or an implied event mechanism.
5. **Behavioral Completeness (for its purpose):** Each concept must offer all the actions and queries necessary to fully fulfill its stated purpose, without relying on other concepts to complete its core logic. The `Labeling` concept, for example, handles all aspects of creating, adding, and deleting labels itself.

By adhering to these principles, you create modular, reusable, and maintainable software units that are robust to changes in other parts of the system.

***
