# laketduku

Loldle-style guessing game with solo mode, real online 1v1 multiplayer, and a hidden admin editor.

## What changed
- **Online multiplayer** is now real-time over WebSockets (create room / join room / host starts match).
- **Admin is hidden** from player UI and moved to `/admin.html`.
- **Admin editor is visual**: upload image, drag-select zone on canvas, focus point is computed and saved.
- Entries are stored server-side in `data/entries.json`.

## Run

```bash
npm install
ADMIN_TOKEN=your-secret npm start
```

Open:
- Player app: <http://localhost:4173>
- Hidden admin: <http://localhost:4173/admin.html>

When opening admin, enter the same `ADMIN_TOKEN` in the prompt.
