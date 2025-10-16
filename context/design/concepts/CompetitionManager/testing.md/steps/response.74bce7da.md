---
timestamp: 'Wed Oct 15 2025 02:54:42 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251015_025442.4e8cc379.md]]'
content_id: 74bce7dab4ce2fee4ff72814a04376324bc3af8290cca96fd4bda161c3257297
---

# response:

To ensure concepts are independent:

1. **No Direct Inter-Concept Imports**: Concepts should not directly import or reference implementation details (classes, methods, or internal types) of other concepts. Their code should be entirely self-contained within their respective boundaries.
2. **Generic Parameters Only**: Concepts must operate exclusively on their specified generic type parameters (e.g., `User`, `Target`, `Item`). This forces them to treat external entities as opaque identifiers, preventing them from assuming or relying on the internal structure or behavior of objects managed by other concepts.
3. **Separate, Encapsulated State**: Each concept manages its own distinct portion of the application state. While multiple concepts might refer to the same *logical entity* (like `User`), they store only the facets of that entity relevant to their specific purpose. There is no shared mutable state that concepts can directly manipulate in another concept's domain.
4. **Single, Focused Purpose**: A concept should have a narrow, well-defined, and user-centric purpose. This prevents feature creep and ensures that a concept doesn't accumulate responsibilities that rightfully belong to other concepts, thus minimizing the chances of hidden dependencies.
5. **Behavioral Completeness**: Within its defined purpose, a concept must be behaviorally complete. It shouldn't require another concept to complete its core function. If interactions between concepts are necessary, they should occur through a high-level coordination layer (like a synchronization mechanism) that passes generic identifiers and defined outputs, rather than direct method calls.
6. **Pre/Post Conditions Refer to Own State**: The `requires` and `effects` clauses of an action must strictly refer to the concept's own state and its generic parameters. They should not mention or modify the state of other concepts.

By strictly adhering to these guidelines, especially the use of generic parameters and the isolation of state, concepts become highly decoupled, reusable, and easier to reason about in isolation.
