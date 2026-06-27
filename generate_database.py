import csv
import json
import math
import re
import hashlib
import os
from datetime import datetime

# Source dataset configuration
CSV_FILENAME = "FIFA23_official_data.csv"
TARGET_PLAYERS_TOTAL = 1000

# Target position ratios (summing to 0.9698, will be normalized to 1.0)
POSITION_RATIOS = {
    'GK':  0.0707,
    'LB':  0.0556,
    'RB':  0.0556,
    'CB':  0.1414,
    'LWB': 0.0202,
    'RWB': 0.0202,
    'CDM': 0.0707,
    'CM':  0.1212,
    'CAM': 0.0707,
    'LM':  0.0404,
    'RM':  0.0404,
    'LW':  0.0556,
    'RW':  0.0556,
    'CF':  0.0404,
    'ST':  0.1111
}

# Target rating distribution ratios within each position
TIER_TARGET_RATIOS = {
    'Elite': 0.03,        # 90+ overall
    'World Class': 0.12,  # 86-89 overall
    'Excellent': 0.25,    # 82-85 overall
    'Good': 0.35,         # 78-81 overall
    'Average': 0.25       # <= 77 overall (will be >= 70 due to filter)
}

# Predefined base stats at Overall = 70 and Overall = 95
# Format: (pace, shooting, passing, dribbling, defending, physical)
BASE_STATS_70 = {
    'GK':  (68, 66, 66, 70, 68, 65),
    'CB':  (60, 35, 52, 55, 72, 72),
    'LB':  (74, 48, 62, 66, 66, 66),
    'RB':  (74, 48, 62, 66, 66, 66),
    'LWB': (74, 48, 62, 66, 66, 66),
    'RWB': (74, 48, 62, 66, 66, 66),
    'CDM': (62, 52, 66, 66, 70, 72),
    'CM':  (65, 60, 70, 70, 62, 66),
    'CAM': (72, 66, 70, 72, 38, 58),
    'LM':  (78, 62, 64, 70, 40, 58),
    'RM':  (78, 62, 64, 70, 40, 58),
    'LW':  (80, 64, 64, 72, 35, 56),
    'RW':  (80, 64, 64, 72, 35, 56),
    'CF':  (74, 68, 64, 72, 35, 64),
    'ST':  (72, 70, 58, 68, 32, 68)
}

BASE_STATS_95 = {
    'GK':  (90, 88, 88, 94, 92, 85),
    'CB':  (82, 50, 75, 74, 96, 92),
    'LB':  (94, 68, 84, 86, 88, 84),
    'RB':  (94, 68, 84, 86, 88, 84),
    'LWB': (94, 68, 84, 86, 88, 84),
    'RWB': (94, 68, 84, 86, 88, 84),
    'CDM': (78, 72, 86, 82, 92, 90),
    'CM':  (80, 82, 94, 92, 80, 84),
    'CAM': (86, 88, 94, 95, 48, 74),
    'LM':  (95, 82, 85, 92, 52, 76),
    'RM':  (95, 82, 85, 92, 52, 76),
    'LW':  (96, 88, 86, 95, 45, 74),
    'RW':  (96, 88, 86, 95, 45, 74),
    'CF':  (90, 90, 84, 92, 45, 82),
    'ST':  (92, 94, 76, 88, 42, 88)
}

# Fallback positions in case a position lacks players >= 70 overall
FALLBACK_POSITIONS = {
    'LWB': ['LB', 'LM', 'CB'],
    'RWB': ['RB', 'RM', 'CB'],
    'CF': ['ST', 'CAM', 'LW', 'RW'],
    'GK': ['CB', 'CDM'],
    'LB': ['LWB', 'CB'],
    'RB': ['RWB', 'CB'],
    'CB': ['CDM', 'RB', 'LB'],
    'CDM': ['CM', 'CB'],
    'CM': ['CAM', 'CDM'],
    'CAM': ['CM', 'CF'],
    'LM': ['LW', 'RM'],
    'RM': ['RW', 'LM'],
    'LW': ['LM', 'RW'],
    'RW': ['RM', 'LW'],
    'ST': ['CF', 'CAM']
}

# Mapping of major clubs to their respective leagues
LEAGUE_MAPPING = {
    # Premier League
    'Manchester United': 'Premier League', 'Manchester City': 'Premier League', 'Liverpool': 'Premier League',
    'Tottenham Hotspur': 'Premier League', 'Chelsea': 'Premier League', 'Arsenal': 'Premier League',
    'Newcastle United': 'Premier League', 'Aston Villa': 'Premier League', 'West Ham United': 'Premier League',
    'Leicester City': 'Premier League', 'Wolverhampton Wanderers': 'Premier League', 'Everton': 'Premier League',
    'Leeds United': 'Premier League', 'Crystal Palace': 'Premier League', 'Brentford': 'Premier League',
    'Brighton & Hove Albion': 'Premier League', 'Southampton': 'Premier League', 'Fulham': 'Premier League',
    'Nottingham Forest': 'Premier League', 'Bournemouth': 'Premier League',
    'AFC Richmond': 'Premier League',
    
    # LaLiga
    'Real Madrid CF': 'LaLiga', 'FC Barcelona': 'LaLiga', 'Atlético de Madrid': 'LaLiga',
    'Sevilla FC': 'LaLiga', 'Real Sociedad': 'LaLiga', 'Real Betis Balompié': 'LaLiga',
    'Villarreal CF': 'LaLiga', 'Valencia CF': 'LaLiga', 'Athletic Club de Bilbao': 'LaLiga',
    'CA Osasuna': 'LaLiga', 'Rayo Vallecano': 'LaLiga', 'RC Celta de Vigo': 'LaLiga',
    'RCD Espanyol de Barcelona': 'LaLiga', 'Getafe CF': 'LaLiga', 'Elche CF': 'LaLiga',
    'Real Valladolid CF': 'LaLiga', 'UD Almería': 'LaLiga', 'Cádiz CF': 'LaLiga',
    'Girona FC': 'LaLiga', 'RCD Mallorca': 'LaLiga',
    'Deportivo Alavés': 'LaLiga', 'Granada CF': 'LaLiga', 'Unión Deportiva Las Palmas': 'LaLiga',
    
    # Bundesliga
    'FC Bayern München': 'Bundesliga', 'Borussia Dortmund': 'Bundesliga', 'Bayer 04 Leverkusen': 'Bundesliga',
    'RB Leipzig': 'Bundesliga', 'Eintracht Frankfurt': 'Bundesliga', 'VfL Wolfsburg': 'Bundesliga',
    'Borussia Mönchengladbach': 'Bundesliga', 'TSG Hoffenheim': 'Bundesliga', 'SC Freiburg': 'Bundesliga',
    'Sport-Club Freiburg': 'Bundesliga',
    '1. FC Union Berlin': 'Bundesliga', '1. FC Köln': 'Bundesliga', '1. FSV Mainz 05': 'Bundesliga',
    'SV Werder Bremen': 'Bundesliga', 'FC Schalke 04': 'Bundesliga', 'VfB Stuttgart': 'Bundesliga',
    'VfL Bochum 1848': 'Bundesliga', 'FC Augsburg': 'Bundesliga', 'Hertha BSC': 'Bundesliga',
    
    # Serie A
    'AC Milan': 'Serie A', 'Inter': 'Serie A', 'Juventus': 'Serie A', 'Napoli': 'Serie A',
    'Lazio': 'Serie A', 'Roma': 'Serie A', 'Atalanta': 'Serie A', 'Fiorentina': 'Serie A',
    'Hellas Verona': 'Serie A', 'Torino': 'Serie A', 'Sassuolo': 'Serie A', 'Bologna': 'Serie A',
    'Udinese': 'Serie A', 'Sampdoria': 'Serie A', 'Salernitana': 'Serie A', 'Empoli': 'Serie A',
    'Monza': 'Serie A', 'Spezia': 'Serie A', 'Lecce': 'Serie A', 'Cremonese': 'Serie A',
    'AC Monza': 'Serie A', 'U.S. Sassuolo Calcio': 'Serie A', 'Udinese Calcio': 'Serie A',
    'U.C. Sampdoria': 'Serie A',
    
    # Ligue 1
    'Paris Saint-Germain': 'Ligue 1', 'Olympique de Marseille': 'Ligue 1', 'AS Monaco': 'Ligue 1',
    'Stade Rennais FC': 'Ligue 1', 'OGC Nice': 'Ligue 1', 'Olympique Lyonnais': 'Ligue 1',
    'LOSC Lille': 'Ligue 1', 'RC Lens': 'Ligue 1', 'FC Nantes': 'Ligue 1', 'Stade de Reims': 'Ligue 1',
    'Montpellier Hérault SC': 'Ligue 1', 'Toulouse FC': 'Ligue 1', 'Stade Brestois 29': 'Ligue 1',
    'FC Lorient': 'Ligue 1', 'ESTAC Troyes': 'Ligue 1', 'Clermont Foot 63': 'Ligue 1',
    'Angers SCO': 'Ligue 1', 'AJ Auxerre': 'Ligue 1', 'AC Ajaccio': 'Ligue 1', 'RC Strasbourg Alsace': 'Ligue 1',
    'Racing Club de Lens': 'Ligue 1', 'FC Girondins de Bordeaux': 'Ligue 1',
    
    # Eredivisie
    'Ajax': 'Eredivisie', 'PSV': 'Eredivisie', 'Feyenoord': 'Eredivisie', 'AZ Alkmaar': 'Eredivisie',
    'FC Twente': 'Eredivisie', 'FC Utrecht': 'Eredivisie', 'Vitesse': 'Eredivisie', 'sc Heerenveen': 'Eredivisie',
    'FC Groningen': 'Eredivisie',
    
    # Liga Portugal
    'SL Benfica': 'Liga Portugal', 'Sporting CP': 'Liga Portugal', 'FC Porto': 'Liga Portugal',
    'SC Braga': 'Liga Portugal', 'Vitória de Guimarães': 'Liga Portugal',
    
    # MLS
    'Los Angeles FC': 'MLS', 'LA Galaxy': 'MLS', 'Inter Miami CF': 'MLS', 'New York City FC': 'MLS',
    'Seattle Sounders FC': 'MLS', 'Atlanta United FC': 'MLS', 'Toronto FC': 'MLS', 'New York Red Bulls': 'MLS',
    'Orlando City SC': 'MLS', 'Columbus Crew': 'MLS', 'Portland Timbers': 'MLS', 'Austin FC': 'MLS',
    'Philadelphia Union': 'MLS', 'Nashville SC': 'MLS', 'New England Revolution': 'MLS',
    'Atlanta United': 'MLS', 'Houston Dynamo': 'MLS', 'Minnesota United FC': 'MLS',
    
    # Other Leagues / Rest of World
    'Celtic': 'Scottish Premiership', 'Rangers FC': 'Scottish Premiership',
    'Club Brugge KV': 'Belgian Pro League', 'RSC Anderlecht': 'Belgian Pro League',
    'Royal Antwerp FC': 'Belgian Pro League', 'KRC Genk': 'Belgian Pro League',
    'Galatasaray SK': 'Süper Lig', 'Fenerbahçe SK': 'Süper Lig', 'Beşiktaş JK': 'Süper Lig',
    'Trabzonspor': 'Süper Lig', 'Antalyaspor': 'Süper Lig', 'Adana Demirspor': 'Süper Lig',
    'FC Zenit': 'Russian Premier League', 'Shakhtar Donetsk': 'Ukrainian Premier League',
    'Dynamo Kyiv': 'Ukrainian Premier League', 'Olympiacos CFP': 'Greek Super League',
    'Fenerbahçe': 'Süper Lig', 'Al Nassr': 'Saudi Pro League', 'Al Hilal': 'Saudi Pro League',
    'Al Shabab': 'Saudi Pro League', 'Al Ahli': 'Saudi Pro League', 'Al Ittihad': 'Saudi Pro League',
    'Boca Juniors': 'Argentine Primera División', 'River Plate': 'Argentine Primera División',
    'Estudiantes de La Plata': 'Argentine Primera División',
    'Flamengo': 'Campeonato Brasileiro Série A', 'Palmeiras': 'Campeonato Brasileiro Série A',
    'São Paulo': 'Campeonato Brasileiro Série A', 'Corinthians': 'Campeonato Brasileiro Série A',
    'Club Athletico Paranaense': 'Campeonato Brasileiro Série A', 'Clube Atlético Mineiro': 'Campeonato Brasileiro Série A',
    'Club Atlas': 'Liga MX', 'Club Nacional de Football': 'Uruguayan Primera División',
    'Shanghai Port FC': 'Chinese Super League', 'Wuhan Three Towns': 'Chinese Super League',
    'Vissel Kobe': 'J1 League', 'Dinamo Zagreb': 'Prva HNL', 'SK Slavia Praha': 'Czech First League'
}

def clean_name(name):
    """Remove year prefixes like 22 or 19 and clean whitespace."""
    # Removes leading digits followed by space or non-breaking space (\xa0)
    name = re.sub(r'^\d+[\s\xa0]+', '', name)
    return name.strip()

def normalize_position(raw_pos):
    """Extract position from HTML structure and normalize to standard 15 positions."""
    match = re.search(r'>([A-Z]+)', raw_pos)
    if not match:
        return None
    pos = match.group(1)
    
    if pos in ['SUB', 'RES']:
        return None  # Excluded per selection rules
    
    # Position mappings
    if pos in ['LCB', 'RCB', 'CB']:
        return 'CB'
    elif pos in ['LCM', 'RCM', 'CM']:
        return 'CM'
    elif pos in ['LDM', 'RDM', 'CDM']:
        return 'CDM'
    elif pos in ['LS', 'RS', 'ST']:
        return 'ST'
    elif pos in ['LF', 'RF', 'CF']:
        return 'CF'
    elif pos in ['LAM', 'RAM', 'CAM']:
        return 'CAM'
    
    # LB, RB, LWB, RWB, LM, RM, LW, RW, GK remain unchanged
    return pos

def get_tier(overall):
    """Map Overall rating to one of five draft tiers."""
    if overall >= 90:
        return 'Elite'
    elif overall >= 86:
        return 'World Class'
    elif overall >= 82:
        return 'Excellent'
    elif overall >= 78:
        return 'Good'
    else:
        return 'Average'

def get_interpolated_base(overall, pos):
    """Linearly interpolate base stats for a position based on overall rating."""
    s70 = BASE_STATS_70.get(pos, (70, 70, 70, 70, 70, 70))
    s95 = BASE_STATS_95.get(pos, (85, 85, 85, 85, 85, 85))
    
    interpolated = []
    for v70, v95 in zip(s70, s95):
        val = v70 + (overall - 70) * (v95 - v70) / 25.0
        interpolated.append(val)
    return interpolated

def calculate_face_stats(row, pos, overall, player_id):
    """Estimate or detect player face stats from physical attributes and CSV values."""
    # Parse physical and technical characteristics safely
    try:
        age = int(float(row.get('Age', '25')))
    except ValueError:
        age = 25
    
    try:
        height_str = row.get('Height', '180cm')
        height = int(height_str.replace('cm', ''))
    except ValueError:
        height = 180

    try:
        weight_str = row.get('Weight', '75kg')
        weight = int(weight_str.replace('kg', ''))
    except ValueError:
        weight = 75

    try:
        skill_moves = int(float(row.get('Skill Moves', '3.0')))
    except ValueError:
        skill_moves = 3

    try:
        weak_foot = int(float(row.get('Weak Foot', '3.0')))
    except ValueError:
        weak_foot = 3

    try:
        special = int(float(row.get('Special', '1800')))
    except ValueError:
        special = 1800

    preferred_foot = row.get('Preferred Foot', 'Right')

    # 1. Base interpolation
    pac, sho, pas, dri, defe, phy = get_interpolated_base(overall, pos)

    # 2. Archetype adjustments
    adj_pac, adj_sho, adj_pas, adj_dri, adj_def, adj_phy = 0, 0, 0, 0, 0, 0

    if pos in ['ST', 'CF']:
        if height >= 188:  # Target Man
            adj_phy += 6; adj_pac -= 5; adj_dri -= 3
        elif height < 180 and age < 27:  # Speedster
            adj_pac += 8; adj_dri += 4; adj_phy -= 6
        elif weak_foot >= 4:  # Clinical Finisher
            adj_sho += 5; adj_pas += 2; adj_phy -= 3
    elif pos in ['CM', 'CAM', 'CDM']:
        if special >= 2100:  # Box-to-Box
            adj_phy += 4; adj_def += 4; adj_sho += 3; adj_pac += 3
        elif skill_moves >= 4 or weak_foot >= 4:  # Deep-Lying Playmaker
            adj_pas += 6; adj_dri += 4; adj_phy -= 5
        elif height >= 185 or weight >= 80:  # Enforcer
            adj_phy += 6; adj_def += 5; adj_pac -= 6; adj_dri -= 4
        elif pos == 'CAM':  # Creative CAM
            adj_dri += 6; adj_pas += 4; adj_sho += 3; adj_def -= 5
    elif pos in ['LW', 'RW', 'LM', 'RM']:
        if (preferred_foot == 'Left' and pos in ['RW', 'RM']) or (preferred_foot == 'Right' and pos in ['LW', 'LM']):  # Inverted Winger
            adj_sho += 6; adj_dri += 3; adj_pas -= 4
        elif age < 26:  # Speedy Winger
            adj_pac += 8; adj_dri += 2; adj_def -= 5; adj_phy -= 3
        elif skill_moves >= 4:  # Playmaking Winger
            adj_pas += 6; adj_dri += 3; adj_sho += 3; adj_pac -= 4
    elif pos in ['CB', 'LB', 'RB', 'LWB', 'RWB']:
        if pos == 'CB' and height >= 188:  # Stonewall CB
            adj_phy += 6; adj_def += 4; adj_pac -= 6
        elif pos == 'CB' and special >= 1800:  # Ball-Playing CB
            adj_pas += 6; adj_dri += 4; adj_phy -= 3
        elif pos in ['LB', 'RB', 'LWB', 'RWB'] and height < 178:  # Wingback Speedster
            adj_pac += 8; adj_dri += 3; adj_def -= 4
    elif pos == 'GK':
        if special >= 1500 or skill_moves >= 3:  # Sweeper Keeper
            adj_pas += 6; adj_pac += 4; adj_def -= 2
        else:  # Traditional GK
            adj_def += 4; adj_pac -= 4

    pac += adj_pac
    sho += adj_sho
    pas += adj_pas
    dri += adj_dri
    defe += adj_def
    phy += adj_phy

    # 3. Individual biological modifiers
    if pos != 'GK':
        pac -= 0.4 * (age - 25)
        pac -= 0.2 * (height - 180)
        sho += 1.5 * (weak_foot - 3)
        pas += 1.0 * (weak_foot - 3)
        dri += 1.5 * (skill_moves - 3)
        dri -= 0.15 * (height - 180)
        phy += 0.2 * (height - 180)
        phy += 0.2 * (weight - 75)

    # 4. Deterministic noise using MD5 hash of ID
    h = int(hashlib.md5(str(player_id).encode()).hexdigest(), 16)
    r_pac = (((h >> 0) & 0xFF) / 255.0) * 6 - 3
    r_sho = (((h >> 8) & 0xFF) / 255.0) * 6 - 3
    r_pas = (((h >> 16) & 0xFF) / 255.0) * 6 - 3
    r_dri = (((h >> 24) & 0xFF) / 255.0) * 6 - 3
    r_def = (((h >> 32) & 0xFF) / 255.0) * 6 - 3
    r_phy = (((h >> 40) & 0xFF) / 255.0) * 6 - 3

    pac += r_pac
    sho += r_sho
    pas += r_pas
    dri += r_dri
    defe += r_def
    phy += r_phy

    def clamp(val):
        return int(max(30, min(99, round(val))))

    estimated = {
        "pace": clamp(pac),
        "shooting": clamp(sho),
        "passing": clamp(pas),
        "dribbling": clamp(dri),
        "defending": clamp(defe),
        "physical": clamp(phy)
    }

    # 5. Check if actual face stats exist in the CSV row (case-insensitively)
    final_stats = {}
    for name in ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']:
        csv_val = None
        for rk, rv in row.items():
            if rk.strip().lower() == name:
                csv_val = rv
                break
        if csv_val is not None and csv_val != '' and csv_val != 'nan':
            try:
                final_stats[name] = clamp(float(csv_val))
            except ValueError:
                pass
        if name not in final_stats:
            final_stats[name] = estimated[name]

    return final_stats

def calculate_draft_score(overall, stats, pos):
    """Compute weighted score of draft strength used by the game engine."""
    if pos == 'GK':
        key_avg = (stats['defending'] + stats['dribbling'] + stats['passing']) / 3.0
    elif pos == 'CB':
        key_avg = (stats['defending'] + stats['physical'] + stats['pace']) / 3.0
    elif pos in ['LB', 'RB', 'LWB', 'RWB']:
        key_avg = (stats['pace'] + stats['defending'] + stats['passing'] + stats['dribbling']) / 4.0
    elif pos == 'CDM':
        key_avg = (stats['defending'] + stats['physical'] + stats['passing']) / 3.0
    elif pos == 'CM':
        key_avg = (stats['passing'] + stats['dribbling'] + stats['pace'] + stats['shooting']) / 4.0
    elif pos == 'CAM':
        key_avg = (stats['passing'] + stats['dribbling'] + stats['shooting']) / 3.0
    elif pos in ['LM', 'RM', 'LW', 'RW']:
        key_avg = (stats['pace'] + stats['dribbling'] + stats['shooting'] + stats['passing']) / 4.0
    elif pos in ['CF', 'ST']:
        key_avg = (stats['shooting'] + stats['pace'] + stats['dribbling'] + stats['physical']) / 4.0
    else:
        key_avg = sum(stats.values()) / 6.0
    
    return int(round(overall * 0.5 + key_avg * 0.5))

def calculate_secondary_positions(pos, stats, height, preferred_foot):
    """Dynamically assign secondary positions based on physical and technical stats."""
    secondary = []
    pace = stats['pace']
    shooting = stats['shooting']
    passing = stats['passing']
    dribbling = stats['dribbling']
    defending = stats['defending']
    physical = stats['physical']

    if pos == 'CB':
        if passing >= 70:
            secondary.append('CDM')
        if pace >= 75:
            secondary.append('RB' if preferred_foot == 'Right' else 'LB')
    elif pos == 'ST':
        if dribbling >= 78 or passing >= 70:
            secondary.append('CF')
        if pace >= 85 and height < 183:
            secondary.append('LW' if preferred_foot == 'Left' else 'RW')
    elif pos == 'CAM':
        secondary.append('CM')
        if shooting >= 78:
            secondary.append('CF')
        if pace >= 80:
            secondary.append('LM' if preferred_foot == 'Left' else 'RM')
    elif pos in ['LW', 'RW']:
        secondary.append('LM' if pos == 'LW' else 'RM')
        secondary.append('RW' if pos == 'LW' else 'LW')
        if shooting >= 78 and height >= 180:
            secondary.append('ST')
    elif pos in ['LM', 'RM']:
        secondary.append('LW' if pos == 'LM' else 'RW')
        if defending >= 60:
            secondary.append('LWB' if pos == 'LM' else 'RWB')
    elif pos in ['LB', 'RB', 'LWB', 'RWB']:
        if pos == 'LB': secondary.extend(['LWB', 'RB'])
        elif pos == 'RB': secondary.extend(['RWB', 'LB'])
        elif pos == 'LWB': secondary.extend(['LB', 'RWB'])
        elif pos == 'RWB': secondary.extend(['RB', 'LWB'])
        if height >= 185 and defending >= 78:
            secondary.append('CB')
    elif pos == 'CDM':
        secondary.append('CM')
        if height >= 185 and defending >= 78:
            secondary.append('CB')
            
    # Deduplicate and remove primary position
    unique_sec = []
    for p in secondary:
        if p != pos and p not in unique_sec:
            unique_sec.append(p)
            
    return unique_sec

def calculate_target_counts(total_players):
    """Normalize position ratios to calculate exact counts summing up to target."""
    total_ratio = sum(POSITION_RATIOS.values())
    target_counts = {}
    sum_calculated = 0
    
    for pos, ratio in POSITION_RATIOS.items():
        cnt = int(round(total_players * (ratio / total_ratio)))
        target_counts[pos] = cnt
        sum_calculated += cnt
        
    # Adjust difference on largest positions
    diff = total_players - sum_calculated
    if diff != 0:
        largest_positions = sorted(POSITION_RATIOS.keys(), key=lambda p: POSITION_RATIOS[p], reverse=True)
        for i in range(abs(diff)):
            pos = largest_positions[i % len(largest_positions)]
            target_counts[pos] += 1 if diff > 0 else -1
            
    return target_counts

def get_major_group(pos):
    """Map normalized position to major tactical groups."""
    if pos == 'GK':
        return 'GK'
    elif pos in ['CB', 'LB', 'RB', 'LWB', 'RWB']:
        return 'DEF'
    elif pos in ['CDM', 'CM', 'CAM', 'LM', 'RM']:
        return 'MID'
    elif pos in ['ST', 'CF', 'LW', 'RW']:
        return 'ATT'
    return 'OTH'

def main():
    print("Starting database generation...")
    
    # 1. Read and parse the CSV dataset
    players_by_pos = {}
    total_csv_rows = 0
    
    if not os.path.exists(CSV_FILENAME):
        print(f"Error: {CSV_FILENAME} not found!")
        return

    with open(CSV_FILENAME, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_csv_rows += 1
            raw_pos = row.get('Position')
            if not raw_pos:
                continue
            
            pos = normalize_position(raw_pos)
            if not pos:
                continue
                
            try:
                overall = int(float(row.get('Overall', '0')))
            except ValueError:
                overall = 0
                
            if overall == 0:
                continue
                
            players_by_pos.setdefault(pos, []).append(row)
            
    print(f"Parsed {total_csv_rows} rows from CSV. Extracted valid positions.")
    
    # Filter players to only keep Overall >= 70
    players_by_pos_70 = {}
    for pos, rows in players_by_pos.items():
        players_by_pos_70[pos] = [row for row in rows if int(float(row.get('Overall', '0'))) >= 70]
        print(f"  {pos}: {len(players_by_pos_70[pos])} players available with Overall >= 70 (out of {len(rows)})")
        
    # Calculate target counts per position
    target_counts = calculate_target_counts(TARGET_PLAYERS_TOTAL)
    print(f"Initial target counts: {target_counts}")
    
    # 2. Deficit redistribution logic
    deficits = True
    redistribution_log = []
    
    while deficits:
        deficits = False
        for pos in list(target_counts.keys()):
            needed = target_counts[pos]
            available = len(players_by_pos_70.get(pos, []))
            if needed > available:
                deficit = needed - available
                target_counts[pos] = available
                deficits = True
                
                fallbacks = FALLBACK_POSITIONS.get(pos, [])
                if fallbacks:
                    log_msg = f"Redistributing {deficit} slots from {pos} to fallbacks {fallbacks}"
                    redistribution_log.append(log_msg)
                    print(log_msg)
                    for i in range(deficit):
                        fb_pos = fallbacks[i % len(fallbacks)]
                        target_counts[fb_pos] += 1
                else:
                    log_msg = f"Redistributing {deficit} slots from {pos} to general fallbacks ['CB', 'CM', 'ST']"
                    redistribution_log.append(log_msg)
                    print(log_msg)
                    for i in range(deficit):
                        fb_pos = ['CB', 'CM', 'ST'][i % 3]
                        target_counts[fb_pos] += 1
                        
    print(f"Final redistributed target counts: {target_counts}")
    
    # 3. Balanced Sampling by position and tier (using Overall >= 70 candidates)
    selected_players = []
    validation_issues = []
    
    for pos, target_cnt in target_counts.items():
        candidates = players_by_pos_70.get(pos, [])
        if not candidates:
            if target_cnt > 0:
                validation_issues.append(f"No candidates available for position {pos} with target count {target_cnt}")
            continue
            
        # Group candidates by tier
        tier_groups = {'Elite': [], 'World Class': [], 'Excellent': [], 'Good': [], 'Average': []}
        for c in candidates:
            overall = int(float(c.get('Overall', '0')))
            tier = get_tier(overall)
            tier_groups[tier].append(c)
            
        # Sort each group by overall desc, then potential desc, then name asc
        for t in tier_groups:
            tier_groups[t].sort(key=lambda x: (
                -int(float(x.get('Overall', '0'))),
                -int(float(x.get('Potential', '0'))),
                x.get('Name', '')
            ))
            
        # Distribute target count among tiers
        tier_targets = {}
        allocated = 0
        for tier, ratio in TIER_TARGET_RATIOS.items():
            cnt = int(round(target_cnt * ratio))
            tier_targets[tier] = cnt
            allocated += cnt
            
        # Adjust rounding difference
        diff = target_cnt - allocated
        if diff != 0:
            ordered_tiers = ['Good', 'Excellent', 'Average', 'World Class', 'Elite']
            for i in range(abs(diff)):
                tier = ordered_tiers[i % len(ordered_tiers)]
                tier_targets[tier] += 1 if diff > 0 else -1
                
        # Sample from each tier, applying spillover cascade if needed
        sampled_from_tiers = {t: [] for t in TIER_TARGET_RATIOS}
        spillover = 0
        
        # Cascade order: Elite -> World Class -> Excellent -> Good -> Average
        tiers_list = ['Elite', 'World Class', 'Excellent', 'Good', 'Average']
        
        # Forward pass (elite to average)
        for t in tiers_list:
            needed = tier_targets[t] + spillover
            pool = tier_groups[t]
            if len(pool) >= needed:
                # Even spacing sampling to maximize variety
                if needed > 0:
                    indices = [int(i * len(pool) / needed) for i in range(needed)]
                    sampled_from_tiers[t] = [pool[idx] for idx in indices]
                spillover = 0
            else:
                sampled_from_tiers[t] = pool[:]
                spillover = needed - len(pool)
                
        # Backward pass if spillover is still remaining (average to elite)
        if spillover > 0:
            for t in reversed(tiers_list):
                if spillover <= 0:
                    break
                pool = tier_groups[t]
                # Filter out already selected players
                selected_ids = {p['ID'] for p in sampled_from_tiers[t]}
                remaining_pool = [p for p in pool if p['ID'] not in selected_ids]
                
                if len(remaining_pool) >= spillover:
                    indices = [int(i * len(remaining_pool) / spillover) for i in range(spillover)]
                    sampled_from_tiers[t].extend([remaining_pool[idx] for idx in indices])
                    spillover = 0
                else:
                    sampled_from_tiers[t].extend(remaining_pool)
                    spillover -= len(remaining_pool)
                    
        if spillover > 0:
            validation_issues.append(f"Position {pos} is short by {spillover} players even after redistribution.")
            
        # Combine selected players for this position
        for t in sampled_from_tiers:
            selected_players.extend(sampled_from_tiers[t])
            
    # 4. Clean, enrich, and build the database
    final_players = []
    images_mapping = {}
    temp_list = []
    
    for row in selected_players:
        pid = int(row['ID'])
        name = clean_name(row['Name'])
        overall = int(float(row['Overall']))
        potential = int(float(row.get('Potential', row['Overall'])))
        pos = normalize_position(row['Position'])
        
        # Base and dynamic stats
        stats = calculate_face_stats(row, pos, overall, pid)
        draft_score = calculate_draft_score(overall, stats, pos)
        
        try:
            height_str = row.get('Height', '180cm')
            height = int(height_str.replace('cm', ''))
        except ValueError:
            height = 180

        try:
            weight_str = row.get('Weight', '75kg')
            weight = int(weight_str.replace('kg', ''))
        except ValueError:
            weight = 75
            
        preferred_foot = row.get('Preferred Foot', 'Right')
        
        try:
            weak_foot = int(float(row.get('Weak Foot', '3.0')))
        except ValueError:
            weak_foot = 3

        try:
            skill_moves = int(float(row.get('Skill Moves', '3.0')))
        except ValueError:
            skill_moves = 3

        try:
            age = int(float(row.get('Age', '25')))
        except ValueError:
            age = 25
            
        # Secondary positions
        sec_pos = calculate_secondary_positions(pos, stats, height, preferred_foot)
        
        # Work rate
        work_rate_str = row.get('Work Rate', 'Medium/ Medium')
        parts = [p.strip() for p in work_rate_str.split('/')]
        work_rate = {
            "attack": parts[0] if len(parts) > 0 else "Medium",
            "defense": parts[1] if len(parts) > 1 else "Medium"
        }
        
        # League mapping dynamically from row.get('League') or row.get('league')
        club = row.get('Club', '').strip()
        if not club or club.lower() in ('nan', 'none', 'null', ''):
            club = "Free Agent"
            
        league_val = row.get('League', row.get('league', '')).strip()
        if not league_val or league_val.lower() in ('nan', 'none', 'null', ''):
            if club == "Free Agent":
                league = "Free Agency"
            else:
                league = LEAGUE_MAPPING.get(club, 'Other')
        else:
            league = league_val
        
        # Calculate Captain score: overall * 0.6 + draftScore * 0.3 + internationalReputation * 1.0
        try:
            intl_rep = float(row.get('International Reputation', '1.0'))
        except ValueError:
            intl_rep = 1.0
            
        cap_score = overall * 0.6 + draft_score * 0.3 + intl_rep * 1.0
        
        player_obj = {
            "id": pid,
            "name": name,
            "overall": overall,
            "position": pos,
            "secondaryPositions": sec_pos,
            "nation": row.get('Nationality', 'Unknown'),
            "age": age,
            "preferredFoot": preferred_foot,
            "weakFoot": weak_foot,
            "skillMoves": skill_moves,
            "workRate": work_rate,
            "height": height,
            "weight": weight,
            "potential": potential,
            "pace": stats['pace'],
            "shooting": stats['shooting'],
            "passing": stats['passing'],
            "dribbling": stats['dribbling'],
            "defending": stats['defending'],
            "physical": stats['physical'],
            "playerImage": f"/players/{pid}.png",
            "club": club,
            "league": league,
            "tier": get_tier(overall),
            "draftScore": draft_score,
            "_capScore": cap_score  # Temporary field for sorting
        }
        temp_list.append(player_obj)
        
    # Sort by captain score and mark top 10% (100 players) globally first
    temp_list.sort(key=lambda x: x['_capScore'], reverse=True)
    cap_target = int(len(temp_list) * 0.10)  # 100 players
    
    for i, p in enumerate(temp_list):
        p['isCaptainCandidate'] = True if i < cap_target else False
        
    # Verify group representation and promote if needed to ensure MIN candidates per group
    group_counts = {'GK': 0, 'DEF': 0, 'MID': 0, 'ATT': 0}
    for p in temp_list:
        if p['isCaptainCandidate']:
            g = get_major_group(p['position'])
            if g in group_counts:
                group_counts[g] += 1
                
    print(f"Initial captain candidates group counts: {group_counts}")
    
    # Enforce minimum of 10 captain candidates per major group
    MIN_CAPTAINS_PER_GROUP = 10
    promotions = 0
    for g, count in group_counts.items():
        if count < MIN_CAPTAINS_PER_GROUP:
            needed = MIN_CAPTAINS_PER_GROUP - count
            # Find highest scoring players of this group that are not captains
            candidates_to_promote = [p for p in temp_list if not p['isCaptainCandidate'] and get_major_group(p['position']) == g]
            for p in candidates_to_promote[:needed]:
                p['isCaptainCandidate'] = True
                promotions += len(candidates_to_promote[:needed])
                
    # Remove temporary sorting field
    for p in temp_list:
        del p['_capScore']
        
    # Restore original ID/Overall order or keep sorted
    temp_list.sort(key=lambda x: (-x['overall'], x['name']))
    final_players = temp_list
    
    # Build image mapping
    for p in final_players:
        images_mapping[str(p['id'])] = p['playerImage']
        
    # 5. Run automated checks / validation
    print("Running automated validation checks...")
    validation_status = "PASSED"
    duplicate_ids = 0
    duplicate_names = 0
    missing_fields = 0
    stats_out_of_range = 0
    invalid_positions = 0
    under_threshold_overall = sum(1 for p in final_players if p['overall'] < 70)
    
    seen_ids = set()
    seen_names = set()
    valid_positions_set = set(POSITION_RATIOS.keys())
    
    for p in final_players:
        # Check duplicate ID
        if p['id'] in seen_ids:
            duplicate_ids += 1
        seen_ids.add(p['id'])
        
        # Check duplicate name
        if p['name'] in seen_names:
            duplicate_names += 1
        seen_names.add(p['name'])
        
        # Check missing fields
        for field in ['id', 'name', 'overall', 'position', 'nation', 'age', 'preferredFoot', 'weakFoot', 'skillMoves', 'workRate', 'height', 'weight', 'potential', 'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'playerImage', 'club', 'league', 'tier', 'draftScore', 'isCaptainCandidate']:
            if p.get(field) is None or p.get(field) == '':
                missing_fields += 1
                
        # Check face stats
        for stat in ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']:
            val = p.get(stat, 0)
            if val < 30 or val > 99:
                stats_out_of_range += 1
                
        # Check position
        if p['position'] not in valid_positions_set:
            invalid_positions += 1
            
    if duplicate_ids > 0 or missing_fields > 0 or stats_out_of_range > 0 or invalid_positions > 0 or under_threshold_overall > 0:
        validation_status = "FAILED"
        print(f"Validation WARNING: {duplicate_ids} duplicate IDs, {missing_fields} missing fields, {stats_out_of_range} stats out of range, {invalid_positions} invalid positions, {under_threshold_overall} players under 70 overall.")
    else:
        print("Validation checks passed successfully!")
        
    # 6. Write outputs
    print("Writing database files...")
    
    with open('players.json', 'w', encoding='utf-8') as pf:
        json.dump(final_players, pf, indent=2, ensure_ascii=False)
        
    with open('images.json', 'w', encoding='utf-8') as imf:
        json.dump(images_mapping, imf, indent=2, ensure_ascii=False)
        
    # Assemble metadata
    metadata = {
        "version": "1.0.0",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "totalPlayers": len(final_players),
        "sourceCSV": CSV_FILENAME,
        "config": {
            "targetPlayerCount": TARGET_PLAYERS_TOTAL,
            "positionRatios": POSITION_RATIOS
        },
        "positionCounts": {pos: sum(1 for p in final_players if p['position'] == pos) for pos in POSITION_RATIOS},
        "tierCounts": {
            "Elite": sum(1 for p in final_players if p['tier'] == 'Elite'),
            "World Class": sum(1 for p in final_players if p['tier'] == 'World Class'),
            "Excellent": sum(1 for p in final_players if p['tier'] == 'Excellent'),
            "Good": sum(1 for p in final_players if p['tier'] == 'Good'),
            "Average": sum(1 for p in final_players if p['tier'] == 'Average')
        },
        "ratingDistribution": {
            "avgOverall": round(sum(p['overall'] for p in final_players) / len(final_players), 2),
            "minOverall": min(p['overall'] for p in final_players),
            "maxOverall": max(p['overall'] for p in final_players),
            "counts": {
                "90+": sum(1 for p in final_players if p['overall'] >= 90),
                "86-89": sum(1 for p in final_players if 86 <= p['overall'] <= 89),
                "82-85": sum(1 for p in final_players if 82 <= p['overall'] <= 85),
                "78-81": sum(1 for p in final_players if 78 <= p['overall'] <= 81),
                "74-77": sum(1 for p in final_players if 74 <= p['overall'] <= 77),
                "70-73": sum(1 for p in final_players if 70 <= p['overall'] <= 73),
                "<70": sum(1 for p in final_players if p['overall'] < 70)
            }
        },
        "validationReport": {
            "status": validation_status,
            "duplicateIds": duplicate_ids,
            "duplicateNames": duplicate_names,
            "missingFields": missing_fields,
            "statsOutOfRange": stats_out_of_range,
            "invalidPositions": invalid_positions,
            "underOverallThreshold": under_threshold_overall,
            "validationIssues": validation_issues,
            "redistributionLog": redistribution_log
        }
    }
    
    with open('metadata.json', 'w', encoding='utf-8') as mf:
        json.dump(metadata, mf, indent=2, ensure_ascii=False)
        
    print("Database generation completed successfully!")
    print(f"Generated players.json size: {os.path.getsize('players.json') / 1024:.2f} KB")
    print(f"Generated images.json size: {os.path.getsize('images.json') / 1024:.2f} KB")
    print(f"Generated metadata.json size: {os.path.getsize('metadata.json') / 1024:.2f} KB")

if __name__ == '__main__':
    main()
