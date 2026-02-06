import os
import requests

champions = [
    "Annie",
    "Ashe",
    "Kayle",
    "Morgana",
    "Sivir",
    "Soraka",
    "Tristana",
    "Evelynn",
    "Anivia",
    "Janna",
    "Katarina",
    "Nidalee",
    "Poppy",
    "Akali",
    "MissFortune",
    "Sona",
    "Lux",
    "Leblanc",
    "Irelia",
    "Cassiopeia",
    "Caitlyn",
    "Karma",
    "Vayne",
    "Orianna",
    "Leona",
    "Riven",
    "Shyvana",
    "Ahri",
    "Sejuani",
    "Fiora",
    "Lulu",
    "Zyra",
    "Diana",
    "Syndra",
    "Elise",
    "Nami",
    "Vi",
    "Quinn",
    "Lissandra",
    "Jinx",
    "Kalista",
    "Illaoi",
    "Taliyah",
    "Camille",
    "Xayah",
    "Zoe",
    "Kaisa",
    "Neeko",
    "Yuumi",
    "Qiyana",
    "Senna",
    "Lillia",
    "Samira",
    "Seraphine",
    "Rell",
    "Gwen",
    "Vex",
    "Zeri",
    "Renata",
    "Belveth",
    "Nilah",
    "Naafiri",
    "Briar",
    "Aurora",
    "Ambessa",
    "Mel",
    "Yunara"
]

BASE_URL = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash"
OUTPUT_DIR = "LoL_Female_Splasharts"

os.makedirs(OUTPUT_DIR, exist_ok=True)

for champ in champions:
    champ_dir = os.path.join(OUTPUT_DIR, champ)
    os.makedirs(champ_dir, exist_ok=True)

    print(f"Downloading {champ}...")

    for skin_id in range(0, 30):  # safe upper limit
        url = f"{BASE_URL}/{champ}_{skin_id}.jpg"
        response = requests.get(url)

        if response.status_code == 200:
            file_path = os.path.join(champ_dir, f"{champ}_{skin_id}.jpg")
            with open(file_path, "wb") as f:
                f.write(response.content)
        else:
            # Stop once skins stop existing
            break

print("Done! All available female splash arts downloaded.")
