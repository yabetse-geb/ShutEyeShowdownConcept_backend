---
timestamp: 'Tue Oct 21 2025 00:40:48 GMT-0400 (Eastern Daylight Time)'
parent: '[[..\20251021_004048.f53da4ec.md]]'
content_id: d39f87ef3386d2c0934927eb7dfe4b5b82bf9282a000a7d8cdcc5ce12d63161f
---

# response:

To ensure concepts are independent, follow these key principles outlined in the concept design background:

1. **No Direct Dependencies on Other Concepts**: A concept should not directly import or reference the implementation details (like classes or methods) of another concept. Its functionality must be entirely self-contained. This is a strict rule at the code level, enforced by prohibiting cross-concept `import` statements.
2. **Generic Parameters Only**: Concepts must operate on generic type parameters (like `User`, `Target`, `Item`) rather than concrete types from other concepts. This forces them to treat external objects as opaque identifiers, preventing assumptions about their internal structure or behavior. A concept can only compare these generic values for equality.
3. **Encapsulated State**: Each concept manages its own distinct state. There should be no shared mutable state or direct access to another concept's state. When two concepts deal with the same *entity* (e.g., `User`), they maintain separate "views" of that entity in their respective states. For example, `UserAuthentication` stores a `password` for a `User`, while `UserProfile` stores a `bio`. These are distinct state relations managed in separate, isolated database collections.
4. **Single, User-Relevant Purpose**: A concept should have a clearly defined, narrow, and user-focused purpose. This helps prevent "feature creep" where a concept tries to do too many things, which would naturally lead to dependencies. A specific and evaluable purpose acts as a boundary marker for its functionality.
5. **Behavioral Completeness**: A concept must embody *all* the functionality associated with its specific behavioral concern. It shouldn't rely on other concepts to complete its core purpose. Any interaction between concepts is managed by an external coordination layer that passes generic identifiers between them, not by direct method calls.
6. **Declarative Actions**: Actions are defined in terms of preconditions and postconditions that strictly refer to the concept's *own* state and generic parameters. This declarative style helps to focus on the concept's isolated behavior without involving external logic.

By adhering to these principles—particularly the use of generic parameters and the strict separation of state and code—concepts are designed to be composable and reusable building blocks that can be developed, tested, and understood in isolation.

***
