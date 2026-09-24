Type: Enhancement
Affected area: course entity/controller
BackendAcademy
Summary: Public lookup should not depend on mutable titles or opaque internal IDs alone.
Acceptance criteria: Slugs are generated, normalized, unique, collision-safe, and covered by create/update tests.