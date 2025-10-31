# Prompt Builder Extension

A SwarmUI extension for Danbooru tag connoisseurs who definitely aren't making waifus.

![Prompt Builder Extension Logo](https://github.com/jtreminio/SwarmUI-PromptBuilderExtension/blob/main/Assets/logo.png?raw=true)

Build your ideal anime girl (or suspiciously specific scenario) with the click of a button.
Over 25,000 of the most popular Danbooru tags, neatly categorized and sorted by popularity.
Because typing "1girl, blush, maid, sunset" by hand is for amateurs.

## Features

- Browse tags by category and popularity
- Click to add, drag to reorder
- Insert directly into your prompt with `<pbprompt>`
- Auto-gen images as you click buttons!
- Tags link to Danbooru for your full research
- Search tags by typing, like a caveman
- Open in a pop-out window for full creative... efficiency
- BUTTONS!

Make your workflow faster, your tags cleaner, and your shame slightly more organized.

![Prompt Builder Extension Screenshot](https://github.com/jtreminio/SwarmUI-PromptBuilderExtension/blob/main/Assets/screenshot.png?raw=true)

## Settings

Access settings by clicking the gear icon (⚙) of the extension. Available settings:

### Auto-generate images on tag changes
When enabled, automatically triggers image generation when you add tags.

### Minimum tags required for auto-generate
Sets the threshold of selected tags needed before auto-generation kicks in (default: 3).

### Add Danbooru links to tag items
Shows clickable links next to each tag that open the Danbooru wiki page for that tag.

### Enable debug mode
Enables console logging for debugging purposes.

**Note:** Settings are saved in your browser's localStorage and persist across sessions.

## Categories

The extension comes with the following tag categories:

- Background: Background styles and elements
- Colors: Color-related
- Image Composition: Composition and framing
- Character: Character attributes and features
- Locations: Location and setting
- Sex: Your shame
- Creatures: Creatures
- Design Elements: Design and style elements
- Games: Board Game, Video Games
- Groups: Group configurations
- Jobs: Occupation and role, and items
- Objects: Object and items
- Plants: Plant and flora
- Series: Series and franchise

## Usage

1. Navigate to the **Tools** tab in SwarmUI
2. Select **Prompt Builder** from the dropdown
3. Browse categories on the left panel
4. Click tags to add them to your selection
5. Drag and drop tags to reorder them
6. Use the `<pbprompt>` placeholder in your prompt field
7. Selected tags will automatically replace `<pbprompt>` when generating

You must add `<pbprompt>` somewhere in your prompt:
```
a beautiful landscape, <pbprompt>, high quality
```

When you generate, the tags you've selected are automatically inserted into your prompt and it becomes:
```
a beautiful landscape, mountain, sunset, vibrant colors, high quality
```

## Keyboard Shortcuts

When hovering over a selected tag:
- **E**: Edit the tag text
- **D**: Delete the tag

## License

[MIT](https://github.com/jtreminio/SwarmUI-PromptBuilderExtension/blob/main/LICENSE)
