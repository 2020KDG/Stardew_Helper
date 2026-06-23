using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using StardewModdingAPI;
using StardewModdingAPI.Events;
using StardewValley;

namespace StardewHelperMod
{
    public class ModEntry : Mod
    {
        private ClientWebSocket webSocket;
        private CancellationTokenSource cancellationTokenSource;
        private bool isConnecting = false;

        public override void Entry(IModHelper helper)
        {
            helper.Events.GameLoop.OneSecondUpdateTicked += this.OnOneSecondUpdateTicked;
            helper.Events.GameLoop.ReturnedToTitle += this.OnReturnedToTitle;
        }

        private async void OnOneSecondUpdateTicked(object sender, OneSecondUpdateTickedEventArgs e)
        {
            if (!Context.IsWorldReady)
                return;

            await EnsureWebSocketConnection();

            if (webSocket != null && webSocket.State == WebSocketState.Open)
            {
                var payload = GeneratePayload();
                string jsonString = JsonSerializer.Serialize(payload);
                byte[] bytes = Encoding.UTF8.GetBytes(jsonString);

                try
                {
                    await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellationTokenSource.Token);
                }
                catch (Exception ex)
                {
                    this.Monitor.Log($"Error sending data to WebSocket: {ex.Message}", LogLevel.Error);
                    webSocket.Dispose();
                    webSocket = null;
                }
            }
        }

        private void OnReturnedToTitle(object sender, ReturnedToTitleEventArgs e)
        {
            if (webSocket != null)
            {
                webSocket.Dispose();
                webSocket = null;
            }
        }

        private async Task EnsureWebSocketConnection()
        {
            if (isConnecting) return;
            if (webSocket != null && (webSocket.State == WebSocketState.Open || webSocket.State == WebSocketState.Connecting))
                return;

            isConnecting = true;
            try
            {
                webSocket = new ClientWebSocket();
                cancellationTokenSource = new CancellationTokenSource();
                Uri serverUri = new Uri("ws://127.0.0.1:8765");
                await webSocket.ConnectAsync(serverUri, cancellationTokenSource.Token);
                this.Monitor.Log("Connected to Stardew Helper Overlay WebSocket!", LogLevel.Info);
            }
            catch (Exception)
            {
                // Silent catch, overlay might not be open
                if (webSocket != null)
                {
                    webSocket.Dispose();
                    webSocket = null;
                }
            }
            finally
            {
                isConnecting = false;
            }
        }

        private object GeneratePayload()
        {
            var p = Game1.player;

            // Extract bundles
            var bundlesMap = new Dictionary<int, List<bool>>();
            if (Game1.netWorldState.Value != null && Game1.netWorldState.Value.Bundles != null)
            {
                foreach (var pair in Game1.netWorldState.Value.Bundles.Pairs)
                {
                    var boolList = new List<bool>();
                    for (int i = 0; i < pair.Value.Length; i++)
                    {
                        boolList.Add(pair.Value[i]);
                    }
                    bundlesMap[pair.Key] = boolList;
                }
            }

            // Extract specific monsters killed
            var monstersKilled = new Dictionary<string, int>();
            if (p.stats != null && p.stats.specificMonstersKilled != null)
            {
                foreach (var pair in p.stats.specificMonstersKilled.Keys)
                {
                    monstersKilled[pair] = p.stats.specificMonstersKilled[pair];
                }
            }

            // Mail received
            var mailList = new List<string>(p.mailReceived);

            // Achievements
            var achList = new List<int>(p.achievements);

            // Friendships
            int friendshipFiveHearts = 0;
            int friendshipTenHearts = 0;
            if (p.friendshipData != null)
            {
                foreach (var friendship in p.friendshipData.Values)
                {
                    if (friendship.Points >= 2500) {
                        friendshipTenHearts++;
                        friendshipFiveHearts++;
                    } else if (friendship.Points >= 1250) {
                        friendshipFiveHearts++;
                    }
                }
            }

            int recipesCookedCount = p.recipesCooked != null ? System.Linq.Enumerable.Count(p.recipesCooked.Keys) : 0;
            int craftingRecipesCount = p.craftingRecipes != null ? System.Linq.Enumerable.Count(p.craftingRecipes.Keys) : 0;
            
            uint questsCompleted = 0;
            uint fishCaught = 0;
            uint museumPieces = 0;

            if (p.stats != null)
            {
                // In Stardew Valley 1.6, some stats are stored in the dictionary or as properties.
                // We can safely try to get them via Get() if it's available, or use properties.
                try { questsCompleted = p.stats.Get("questsCompleted"); } catch { questsCompleted = p.stats.QuestsCompleted; }
                try { fishCaught = p.stats.Get("fishCaught"); } catch { fishCaught = p.stats.FishCaught; }
                
                // Museum pieces might be in Game1.netWorldState.Value.MuseumPieces.Count or player stats
                try { museumPieces = p.stats.Get("museumPieces"); } catch { }
            }

            // Fallback for museum pieces if not in stats
            if (museumPieces == 0 && Game1.netWorldState.Value != null && Game1.netWorldState.Value.MuseumPieces != null)
            {
                museumPieces = (uint)System.Linq.Enumerable.Count(Game1.netWorldState.Value.MuseumPieces.Keys);
            }

            return new
            {
                player_name = p.Name,
                farm_name = p.farmName.Value,
                money = p.Money,
                total_money_earned = (int)p.totalMoneyEarned,
                house_upgrade_level = p.HouseUpgradeLevel,
                current_season = Game1.currentSeason,
                day_of_month = Game1.dayOfMonth,
                year = Game1.year,
                achievements = achList,
                bundles = bundlesMap,
                mail_received = mailList,
                has_skull_key = p.hasSkullKey,
                max_stamina = p.MaxStamina,
                farming_level = p.farmingLevel.Value,
                mining_level = p.miningLevel.Value,
                combat_level = p.combatLevel.Value,
                foraging_level = p.foragingLevel.Value,
                fishing_level = p.fishingLevel.Value,
                luck_level = p.luckLevel.Value,
                spouse = p.spouse,
                children_count = p.getChildrenCount(),
                specific_monsters_killed = monstersKilled,
                friendship_five_hearts = friendshipFiveHearts,
                friendship_ten_hearts = friendshipTenHearts,
                recipes_cooked = recipesCookedCount,
                crafting_recipes = craftingRecipesCount,
                quests_completed = questsCompleted,
                fish_caught = fishCaught,
                museum_pieces = museumPieces
            };
        }
    }
}
