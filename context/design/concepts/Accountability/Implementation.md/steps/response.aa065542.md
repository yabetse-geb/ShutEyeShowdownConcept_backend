---
timestamp: 'Wed Nov 05 2025 19:01:41 GMT-0500 (Eastern Standard Time)'
parent: '[[..\20251105_190141.549e5ac4.md]]'
content_id: aa06554268600fbefdd691c095fef1c543e2b9925cc92c4639971b817c70955b
---

# response:

To ensure your concepts are independent, you should follow several key principles at both the design and implementation stages, as outlined in the provided documentation:

### At the Design Stage (Specification):

1. **No Shared State:** A concept's state should be entirely self-contained. It should not reference or depend on the state variables of another concept. For example, a `UserProfile` concept and a `UserAuthentication` concept might both operate on a `User` entity, but they manage different aspects of it (`bio` vs. `password`) in their own isolated state models.
2. **Single, Focused Purpose:** Each concept must have a clear, singular purpose that describes a complete unit of user-relevant functionality. If a concept's purpose starts to bleed into another's (e.g., if a `Commenting` concept also tried to manage user `Reputation`), they should be split. The purpose should be specific and evaluable.
3. **Generic Parameters:** Concepts must not know about specific, concrete types from other parts of the application. They operate on generic type parameters (e.g., `Item`, `User`, `Target`). These parameters are treated as opaque identifiers, allowing the concept to be reused in different contexts without creating dependencies. For example, a `Labeling[Item]` concept can label anything without knowing what an `Item` is.

### At the Implementation Stage (TypeScript Code):

1. **No Cross-Concept Imports:** This is a strict rule. A concept's implementation file (e.g., `CommentingConcept.ts`) **must not** contain any `import` statements that reference another concept's file (e.g., `import UserConcept from "./UserConcept.ts"`). This prevents direct dependencies at the code level.
2. **Communication via Actions and IDs:** When concepts need to interact, they do so indirectly. An external orchestrator (like a server route or another application layer) calls an action on one concept, which may return an ID. This ID can then be passed as a parameter to an action in another concept. The concepts themselves remain unaware of each other's existence.
3. **Data Isolation in the Database:** Each concept should manage its own set of database collections, typically namespaced with the concept's name (e.g., `Labeling.items`, `Commenting.comments`). One concept must never directly read from or write to the collections owned by another concept. This enforces the "no shared state" rule at the persistence layer.

By adhering to these principles, you create a system of loosely coupled, highly reusable, and independently testable components, which is the core goal of concept-oriented design.

***
