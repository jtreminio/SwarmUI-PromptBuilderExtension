using SwarmUI.Core;
using SwarmUI.Utils;
using SwarmUI.Text2Image;
using Newtonsoft.Json.Linq;
using SwarmUI.Accounts;
using SwarmUI.WebAPI;
using System.IO;

namespace PromptBuilderExtension;

/// <summary>Extension that adds a tool to build prompts from categorized tag collections.</summary>
public class PromptBuilderExtension : Extension
{
    private static T2IRegisteredParam<string> _pbPromptParam;
    
    public static Dictionary<string, string> DataCategories = new()
    {
        { "Background", "./data/background.json" },
        { "Colors", "./data/colors.json" },
        { "Image Composition", "./data/image-composition.json" },
        { "Character", "./data/character.json" },
        { "Locations", "./data/locations.json" },
        { "Sex", "./data/sex.json" },
        { "Creatures", "./data/creatures.json" },
        { "Design Elements", "./data/design-elements.json" },
        { "Games", "./data/games.json" },
        { "Groups", "./data/groups.json" },
        { "Jobs", "./data/jobs.json" },
        { "Objects", "./data/objects.json" },
        { "Plants", "./data/plants.json" },
        { "Series", "./data/series.json" }
    };

    public static JObject CombinedData = null;

    public override void OnPreInit()
    {
        ScriptFiles.Add("Assets/prompt-builder.js");
        StyleSheetFiles.Add("Assets/prompt-builder.css");
        LoadDataFiles();
        AddT2IParameters();
    }

    public override void OnInit()
    {
        API.RegisterAPICall(GetPromptBuilderData, false, Permissions.ViewImageHistory);
    }

    private void LoadDataFiles()
    {
        CombinedData = new JObject();
        string assetsPath = $"{FilePath}/Assets";

        foreach (var category in DataCategories)
        {
            string fullPath = $"{assetsPath}/{category.Value}";
            try
            {
                if (File.Exists(fullPath))
                {
                    string jsonContent = File.ReadAllText(fullPath);
                    JToken parsedData = JToken.Parse(jsonContent);
                    CombinedData[category.Key] = parsedData;
                    Logs.Info($"Loaded Prompt Builder data category: {category.Key}");
                }
                else
                {
                    Logs.Warning($"Prompt Builder data file not found: {fullPath}");
                }
            }
            catch (Exception ex)
            {
                Logs.Error($"Failed to load Prompt Builder data file {fullPath}: {ex.Message}");
            }
        }

        Logs.Info($"Prompt Builder Extension loaded {CombinedData.Count} data categories");
    }

    /// <summary>API endpoint to retrieve the combined prompt builder data.</summary>
    public async Task<JObject> GetPromptBuilderData(Session session)
    {
        if (CombinedData == null || CombinedData.Count == 0)
        {
            return new JObject() 
            { 
                ["success"] = false, 
                ["error"] = "No data loaded" 
            };
        }

        return new JObject() 
        { 
            ["success"] = true, 
            ["data"] = CombinedData 
        };
    }

    private static void AddT2IParameters()
    {
        // Register a hidden parameter to store the selected tags
        _pbPromptParam = T2IParamTypes.Register<string>(new T2IParamType(
            Name: "PB Prompt",
            Description: "Prompt Builder selected tags (comma-separated)",
            Default: "",
            VisibleNormally: false,
            OrderPriority: -10
        ));

        PromptRegion.RegisterCustomPrefix("pbprompt");

        T2IParamInput.LateSpecialParameterHandlers.Add(userInput =>
        {
            var prompt = userInput.InternalSet.Get(T2IParamTypes.Prompt);
            
            // Check if prompt contains <pbprompt>
            if (prompt.Contains("<pbprompt>"))
            {
                // Get the comma-delimited tags from the pbprompt parameter
                var pbpromptTags = userInput.InternalSet.Get(_pbPromptParam, "");
                
                if (!string.IsNullOrWhiteSpace(pbpromptTags))
                {
                    Logs.Debug($"PromptBuilder: Replacing <pbprompt> with tags: {pbpromptTags}");
                    // Replace <pbprompt> with the actual tags
                    prompt = prompt.Replace("<pbprompt>", pbpromptTags);
                    userInput.InternalSet.Set(T2IParamTypes.Prompt, prompt);
                }
            }
        });
    }
}
