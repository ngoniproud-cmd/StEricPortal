# Canvas theme boundary

Apply branding through Canvas Theme Editor/account branding first. Treat custom CSS/JavaScript as a versioned compatibility surface: keep it small, test every Canvas upgrade, and never use it to implement authorization or hide data a user can otherwise access.

`theme.css` demonstrates tokens and focus treatment; selectors under Canvas's private DOM are deliberately absent because they are brittle. The full school portal is separate from Canvas.
