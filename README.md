# Prompt Builder Extension

A SwarmUI extension that provides an interactive tool for building prompts from Danbooru tag collections.

![Prompt Builder Extension](https://github.com/jtreminio/SwarmUI-PromptBuilderExtension/blob/main/Assets/logo.png?raw=true)

## Features

- **Hierarchical Tag Browser**: Navigate through organized categories of tags
- **Quick Tag Selection**: Click to select/deselect tags
- **Drag and Drop Reordering**: Rearrange selected tags by dragging them
- **Search Functionality**: Filter tags within each category
- **Insert to Prompt**: Directly insert selected tags into the main prompt field using `<pbprompt>` placeholder
- **Copy to Clipboard**: Copy selected tags to clipboard
- **Pop-out Window**: Open the tool in a separate window for multi-monitor workflows
- **Settings Panel**: Configure behavior with the settings button (⚙)

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

- **Background**: Background styles and elements
- **Colors**: Color-related tags
- **Image Composition**: Composition and framing tags
- **Character**: Character attributes and features
- **Locations**: Location and setting tags
- **Sex**: Sex-related tags
- **Creatures**: Creature and entity tags
- **Design Elements**: Design and style elements
- **Games**: Game-related tags
- **Groups**: Group configurations
- **Jobs**: Occupation and role tags
- **Objects**: Object and item tags
- **Plants**: Plant and flora tags
- **Series**: Series and franchise tags

## Usage

1. Navigate to the **Tools** tab in SwarmUI
2. Select **Prompt Builder** from the dropdown
3. Browse categories on the left panel
4. Click tags to add them to your selection
5. Drag and drop tags to reorder them
6. Use the `<pbprompt>` placeholder in your prompt field
7. Selected tags will automatically replace `<pbprompt>` when generating

### Using with Prompts

Add `<pbprompt>` anywhere in your prompt:
```
a beautiful landscape, <pbprompt>, high quality
```

When you generate, it becomes:
```
a beautiful landscape, mountain, sunset, vibrant colors, high quality
```

## Keyboard Shortcuts

When hovering over a selected tag:
- **E**: Edit the tag text
- **D**: Delete the tag

## License

MIT
