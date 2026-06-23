use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaveData {
    pub player_name: String,
    pub farm_name: String,
    pub money: i32,
    pub total_money_earned: u32,
    pub house_upgrade_level: i32,
    pub current_season: String,
    pub day_of_month: i32,
    pub year: i32,
    pub achievements: Vec<i32>,
    pub bundles: std::collections::HashMap<i32, Vec<bool>>,
    pub museum_pieces: i32,
    pub quests_completed: i32,
    pub fish_caught: i32,
    pub recipes_cooked: i32,
    pub crafting_recipes: i32,
    pub mail_received: Vec<String>,
    pub friendship_five_hearts: i32,
    pub friendship_ten_hearts: i32,

    // 2차 대규모 확장 (Ultimate Expansion)
    pub gender: String,
    pub favorite_thing: String,
    pub spouse: String,
    pub children_count: i32,

    pub max_health: i32,
    pub max_stamina: i32,
    pub farming_level: i32,
    pub mining_level: i32,
    pub combat_level: i32,
    pub foraging_level: i32,
    pub fishing_level: i32,
    pub luck_level: i32,

    pub days_played: i32,
    pub time_played: String, // 혹은 i32(분)로 저장하고 프론트에서 파싱
    pub daily_luck: f64,

    pub has_rusty_key: bool,
    pub has_skull_key: bool,
    pub has_club_card: bool,
    pub has_dark_talisman: bool,
    pub has_magic_ink: bool,
    pub has_town_key: bool,

    // 단순 카운트가 아닌 진짜 컬렉션 수집을 원한다면 나중에 Vec이나 HashMap 가능. 일단은 확장 대비.
    pub minerals_found: i32,
    pub archaeology_found: i32,
    pub basic_shipped: i32,
    pub specific_monsters_killed: std::collections::HashMap<String, i32>,
}

pub fn get_latest_save_file() -> Option<PathBuf> {
    let app_data = std::env::var("APPDATA").ok()?;
    let saves_dir = PathBuf::from(app_data).join("StardewValley").join("Saves");

    if !saves_dir.exists() {
        return None;
    }

    let mut latest_dir: Option<PathBuf> = None;
    let mut latest_time = std::time::SystemTime::UNIX_EPOCH;

    if let Ok(entries) = fs::read_dir(saves_dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    if let Ok(modified) = meta.modified() {
                        if modified > latest_time {
                            latest_time = modified;
                            latest_dir = Some(entry.path());
                        }
                    }
                }
            }
        }
    }

    if let Some(dir) = latest_dir {
        let dir_name = dir.file_name()?.to_str()?;
        let save_file = dir.join(dir_name);
        println!("Checking save file at: {:?}", save_file);
        if save_file.exists() {
            return Some(save_file);
        } else {
            println!("Save file does not exist: {:?}", save_file);
        }
    }

    None
}

pub fn parse_save_file(path: &PathBuf) -> Result<SaveData, String> {
    let xml = fs::read_to_string(path).map_err(|e| e.to_string())?;

    let mut player_name = String::new();
    let mut farm_name = String::new();
    let mut money = 0;
    let mut total_money_earned: u32 = 0;
    let mut house_upgrade_level = 0;
    let mut current_season = String::new();
    let mut day_of_month = 0;
    let mut year = 0;

    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(true);

    let mut in_player = false;
    let mut in_achievements = false;
    let mut achievements = Vec::new();

    let mut in_bundles = false;
    let mut in_bundle_item = false;
    let mut in_bundle_key = false;
    let mut in_bundle_value = false;
    let mut current_bundle_key: Option<i32> = None;
    let mut current_bundle_value: Vec<bool> = Vec::new();
    let mut bundles_map = std::collections::HashMap::new();

    let mut current_tag = String::new();
    let mut buf = Vec::new();

    // New Tracking Variables
    let mut in_stats = false;
    let mut in_museum = false;
    let mut in_mail = false;
    let mut in_friendship = false;
    let mut in_recipes_cooked = false;
    let mut in_crafting_recipes = false;
    let mut in_friendship_points = false;

    let mut museum_pieces = 0;
    let mut quests_completed = 0;
    let mut fish_caught = 0;
    let mut recipes_cooked = 0;
    let mut crafting_recipes = 0;
    let mut mail_received = Vec::new();
    let mut friendship_five_hearts = 0;
    let mut friendship_ten_hearts = 0;

    // 2nd Expansion
    let mut gender = String::new();
    let mut favorite_thing = String::new();
    let mut spouse = String::new();
    let mut children_count = 0;

    let mut max_health = 0;
    let mut max_stamina = 0;
    let mut farming_level = 0;
    let mut mining_level = 0;
    let mut combat_level = 0;
    let mut foraging_level = 0;
    let mut fishing_level = 0;
    let mut luck_level = 0;

    let mut days_played = 0;
    let mut time_played = String::new();
    let mut daily_luck = 0.0;

    let mut has_rusty_key = false;
    let mut has_skull_key = false;
    let mut has_club_card = false;
    let mut has_dark_talisman = false;
    let mut has_magic_ink = false;
    let mut has_town_key = false;

    let mut in_minerals_found = false;
    let mut in_archaeology_found = false;
    let mut in_basic_shipped = false;

    let mut specific_monsters_killed = std::collections::HashMap::new();
    let mut in_specific_monsters_killed = false;
    let mut in_smk_item = false;
    let mut in_smk_key = false;
    let mut in_smk_value = false;
    let mut current_smk_key = String::new();

    let mut minerals_found = 0;
    let mut archaeology_found = 0;
    let mut basic_shipped = 0;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_tag = name.clone();
                if name == "player" {
                    in_player = true;
                } else if name == "achievements" {
                    in_achievements = true;
                } else if name == "bundles" {
                    in_bundles = true;
                } else if name == "stats" {
                    in_stats = true;
                } else if name == "museumPieces" {
                    in_museum = true;
                } else if name == "mailReceived" {
                    in_mail = true;
                } else if name == "friendshipData" {
                    in_friendship = true;
                } else if name == "recipesCooked" {
                    in_recipes_cooked = true;
                } else if name == "craftingRecipes" {
                    in_crafting_recipes = true;
                } else if name == "mineralsFound" {
                    in_minerals_found = true;
                } else if name == "archaeologyFound" {
                    in_archaeology_found = true;
                } else if name == "basicShipped" {
                    in_basic_shipped = true;
                } else if in_bundles && name == "item" {
                    in_bundle_item = true;
                    current_bundle_key = None;
                    current_bundle_value.clear();
                } else if in_bundle_item && name == "key" {
                    in_bundle_key = true;
                } else if in_bundle_item && name == "value" {
                    in_bundle_value = true;
                } else if in_stats && name == "specificMonstersKilled" {
                    in_specific_monsters_killed = true;
                } else if in_specific_monsters_killed && name == "item" {
                    in_smk_item = true;
                    current_smk_key.clear();
                } else if in_smk_item && name == "key" {
                    in_smk_key = true;
                } else if in_smk_item && name == "value" {
                    in_smk_value = true;
                } else if in_museum && name == "item" {
                    museum_pieces += 1;
                } else if in_recipes_cooked && name == "item" {
                    recipes_cooked += 1;
                } else if in_crafting_recipes && name == "item" {
                    crafting_recipes += 1;
                } else if in_minerals_found && name == "item" {
                    minerals_found += 1;
                } else if in_archaeology_found && name == "item" {
                    archaeology_found += 1;
                } else if in_basic_shipped && name == "item" {
                    basic_shipped += 1;
                } else if in_friendship && name == "Points" {
                    in_friendship_points = true;
                }
            }
            Ok(Event::End(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if name == "player" {
                    in_player = false;
                } else if name == "achievements" {
                    in_achievements = false;
                } else if name == "bundles" {
                    in_bundles = false;
                } else if name == "stats" {
                    in_stats = false;
                } else if name == "museumPieces" {
                    in_museum = false;
                } else if name == "mailReceived" {
                    in_mail = false;
                } else if name == "friendshipData" {
                    in_friendship = false;
                } else if name == "recipesCooked" {
                    in_recipes_cooked = false;
                } else if name == "craftingRecipes" {
                    in_crafting_recipes = false;
                } else if name == "mineralsFound" {
                    in_minerals_found = false;
                } else if name == "archaeologyFound" {
                    in_archaeology_found = false;
                } else if name == "basicShipped" {
                    in_basic_shipped = false;
                } else if in_bundles && name == "item" {
                    in_bundle_item = false;
                    if let Some(k) = current_bundle_key {
                        bundles_map.insert(k, current_bundle_value.clone());
                    }
                } else if in_bundle_item && name == "key" {
                    in_bundle_key = false;
                } else if in_bundle_item && name == "value" {
                    in_bundle_value = false;
                } else if in_stats && name == "specificMonstersKilled" {
                    in_specific_monsters_killed = false;
                } else if in_specific_monsters_killed && name == "item" {
                    in_smk_item = false;
                } else if in_smk_item && name == "key" {
                    in_smk_key = false;
                } else if in_smk_item && name == "value" {
                    in_smk_value = false;
                } else if in_friendship && name == "Points" {
                    in_friendship_points = false;
                }
                current_tag.clear();
            }
            Ok(Event::Text(e)) => {
                let text = String::from_utf8_lossy(e.as_ref()).to_string();
                if in_achievements {
                    if current_tag == "int" {
                        if let Ok(val) = text.parse::<i32>() {
                            achievements.push(val);
                        }
                    }
                } else if in_specific_monsters_killed {
                    if in_smk_key && current_tag == "string" {
                        current_smk_key = text;
                    } else if in_smk_value && current_tag == "int" {
                        if let Ok(val) = text.parse::<i32>() {
                            specific_monsters_killed.insert(current_smk_key.clone(), val);
                        }
                    }
                } else if in_stats {
                    if current_tag == "questsCompleted" && quests_completed == 0 {
                        quests_completed = text.parse().unwrap_or(0);
                    } else if current_tag == "fishCaught" && fish_caught == 0 {
                        fish_caught = text.parse().unwrap_or(0);
                    }
                } else if in_mail {
                    if current_tag == "string" {
                        mail_received.push(text);
                    }
                } else if in_friendship_points {
                    if let Ok(points) = text.parse::<i32>() {
                        if points >= 2500 {
                            friendship_ten_hearts += 1;
                            friendship_five_hearts += 1;
                        } else if points >= 1250 {
                            friendship_five_hearts += 1;
                        }
                    }
                } else if in_player {
                    if current_tag == "name" && player_name.is_empty() {
                        player_name = text;
                    } else if current_tag == "farmName" && farm_name.is_empty() {
                        farm_name = text;
                    } else if current_tag == "money" && money == 0 {
                        money = text.parse().unwrap_or(0);
                    } else if current_tag == "totalMoneyEarned" && total_money_earned == 0 {
                        total_money_earned = text.parse().unwrap_or(0);
                    } else if current_tag == "houseUpgradeLevel" && house_upgrade_level == 0 {
                        house_upgrade_level = text.parse().unwrap_or(0);
                    } else if current_tag == "gender" && gender.is_empty() {
                        gender = text;
                    } else if current_tag == "favoriteThing" && favorite_thing.is_empty() {
                        favorite_thing = text;
                    } else if current_tag == "spouse" && spouse.is_empty() {
                        spouse = text;
                    } else if current_tag == "childrenCount" && children_count == 0 {
                        children_count = text.parse().unwrap_or(0);
                    } else if current_tag == "maxHealth" && max_health == 0 {
                        max_health = text.parse().unwrap_or(0);
                    } else if current_tag == "maxStamina" && max_stamina == 0 {
                        max_stamina = text.parse().unwrap_or(0);
                    } else if current_tag == "farmingLevel" && farming_level == 0 {
                        farming_level = text.parse().unwrap_or(0);
                    } else if current_tag == "miningLevel" && mining_level == 0 {
                        mining_level = text.parse().unwrap_or(0);
                    } else if current_tag == "combatLevel" && combat_level == 0 {
                        combat_level = text.parse().unwrap_or(0);
                    } else if current_tag == "foragingLevel" && foraging_level == 0 {
                        foraging_level = text.parse().unwrap_or(0);
                    } else if current_tag == "fishingLevel" && fishing_level == 0 {
                        fishing_level = text.parse().unwrap_or(0);
                    } else if current_tag == "luckLevel" && luck_level == 0 {
                        luck_level = text.parse().unwrap_or(0);
                    } else if current_tag == "daysPlayed" && days_played == 0 {
                        days_played = text.parse().unwrap_or(0);
                    } else if current_tag == "millisecondsPlayed" {
                        if let Ok(ms) = text.parse::<u64>() {
                            let total_minutes = ms / 60000;
                            let hours = total_minutes / 60;
                            let minutes = total_minutes % 60;
                            time_played = format!("{}h {}m", hours, minutes);
                        }
                    } else if current_tag == "timePlayed" && time_played.is_empty() {
                        time_played = text;
                    } else if current_tag == "dailyLuck" && daily_luck == 0.0 {
                        daily_luck = text.parse().unwrap_or(0.0);
                    } else if current_tag == "hasRustyKey" {
                        has_rusty_key = text == "true";
                    } else if current_tag == "hasSkullKey" {
                        has_skull_key = text == "true";
                    } else if current_tag == "hasClubCard" {
                        has_club_card = text == "true";
                    } else if current_tag == "hasDarkTalisman" {
                        has_dark_talisman = text == "true";
                    } else if current_tag == "hasMagicInk" {
                        has_magic_ink = text == "true";
                    } else if current_tag == "hasTownKey" {
                        has_town_key = text == "true";
                    }
                } else if in_bundle_item {
                    if in_bundle_key && current_tag == "int" {
                        current_bundle_key = text.parse().ok();
                    } else if in_bundle_value && current_tag == "boolean" {
                        current_bundle_value.push(text == "true");
                    }
                } else {
                    if current_tag == "currentSeason" && current_season.is_empty() {
                        current_season = text;
                    } else if current_tag == "dayOfMonth" && day_of_month == 0 {
                        day_of_month = text.parse().unwrap_or(0);
                    } else if current_tag == "year" && year == 0 {
                        year = text.parse().unwrap_or(0);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => (),
        }
        buf.clear();
    }

    Ok(SaveData {
        player_name,
        farm_name,
        money,
        total_money_earned,
        house_upgrade_level,
        current_season,
        day_of_month,
        year,
        achievements,
        bundles: bundles_map,
        museum_pieces,
        quests_completed,
        fish_caught,
        recipes_cooked,
        crafting_recipes,
        mail_received,
        friendship_five_hearts,
        friendship_ten_hearts,

        gender,
        favorite_thing,
        spouse,
        children_count,
        max_health,
        max_stamina,
        farming_level,
        mining_level,
        combat_level,
        foraging_level,
        fishing_level,
        luck_level,
        days_played,
        time_played,
        daily_luck,
        has_rusty_key,
        has_skull_key,
        has_club_card,
        has_dark_talisman,
        has_magic_ink,
        has_town_key,
        minerals_found,
        archaeology_found,
        basic_shipped,
        specific_monsters_killed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_parsing() {
        if let Some(save) = get_latest_save_file() {
            println!("TEST: Found save file {:?}", save);
            match parse_save_file(&save) {
                Ok(data) => println!("TEST: Data: {:?}", data),
                Err(e) => println!("TEST: Err: {}", e),
            }
        } else {
            println!("TEST: No save file found.");
        }
    }
}
