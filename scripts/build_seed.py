"""fitness_12hefte.xlsx -> src/data/seed.json + supabase/seed.sql

Run: python3 scripts/build_seed.py path/to/fitness_12hefte.xlsx
Bütün çəkilər xlsx-dəki kimi çiy / quru / hazır çəkidir.
"""
import json, sys, re, os
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else 'fitness_12hefte.xlsx'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
wb = openpyxl.load_workbook(SRC, data_only=True)

def slug(s):
    t = s.lower()
    for a, b in [('ə','e'),('ı','i'),('ö','o'),('ü','u'),('ç','c'),('ş','s'),('ğ','g')]:
        t = t.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '_', t).strip('_')

# ---------- foods ----------
STATE = {
    'Düyü (ağ)': 'quru', 'Qarabaşaq': 'quru', 'Yulaf yarması': 'quru',
}
FRUITS = {'Alma','Armud','Naringi','Portağal','Kivi','Xurma','Nar (dənələri)','Banan'}
DISPLAY = {'Toyuq filesi (dərisiz)': 'Toyuq filesi', 'Düyü (ağ)': 'Düyü', 'Yulaf yarması': 'Yulaf',
           'Nar (dənələri)': 'Nar dənəsi', 'Qatıq 2.5%': 'Qatıq 2,5%', 'Süd 2.5%': 'Süd 2,5%'}
UNITS = {'Yumurta': ('ədəd', 55), 'Çovdar çörəyi': ('dilim', 35)}
foods = []
fmap = {}
for r in wb['Ərzaq bazası'].iter_rows(min_row=2, values_only=True):
    name, kcal, p, f, c, note = r[:6]
    if not name or kcal is None or name.startswith('Mənbə'):
        continue
    note = (note or '').lower()
    state = STATE.get(name) or ('çiy' if note.startswith('çiy') else 'hazır')
    if name in FRUITS: state = 'hazır'
    fid = slug(DISPLAY.get(name, name))
    u = UNITS.get(name)
    row = dict(id=fid, name=DISPLAY.get(name, name), state=state, kcal_100g=float(kcal),
               protein_100g=float(p), fat_100g=float(f), carb_100g=float(c),
               unit_name=u[0] if u else None, unit_grams=u[1] if u else None,
               is_fruit=name in FRUITS, note=r[5] or None)
    foods.append(row); fmap[name] = row

# ---------- menu ----------
SLOTS = {'07:30': 'seher', '10:30': 'ara_1', '13:00': 'nahar', '16:30': 'ara_2', '20:15': 'axsam'}
day = 0; meals = {}  # (day, slot) -> {name, items}
for r in wb['Menyu'].iter_rows(min_row=2, values_only=True):
    a, b, c, g = r[0], r[1], r[2], r[3]
    if isinstance(a, str) and re.match(r'^\d\. ', a) and b is None and c is None:
        n = int(a[0])
        if n >= day or True:
            day = n
        continue
    if a in SLOTS and c:
        k = (day, SLOTS[a])
        meals.setdefault(k, {'name': b, 'items': []})['items'].append((fmap[c]['id'], float(g)))

# the weekly summary rows also start with "1. B.e." – they have no items so are harmless
recipes = []; rkey = {}; plan = []
for (d, s), m in sorted(meals.items()):
    sig = (m['name'], tuple(m['items']))
    if sig not in rkey:
        base = slug(m['name']); rid = base; i = 2
        while any(x['id'] == rid for x in recipes):
            rid = f'{base}_{i}'; i += 1
        rkey[sig] = rid
        recipes.append(dict(id=rid, name=m['name'].replace('(yağsız)', '(az yağlı)'), slot=s,
                            is_portable=(s == 'nahar'),
                            items=[dict(food_id=f, grams=g) for f, g in m['items']]))
    plan.append(dict(weekday=d, slot=s, recipe_id=rkey[sig]))

fid = {f['id']: f for f in foods}
def macros(items):
    t = dict(kcal=0, protein=0, fat=0, carb=0)
    for it in items:
        f = fid[it['food_id']]; k = it['grams'] / 100
        t['kcal'] += f['kcal_100g'] * k; t['protein'] += f['protein_100g'] * k
        t['fat'] += f['fat_100g'] * k; t['carb'] += f['carb_100g'] * k
    return t
for d in range(1, 8):
    tot = dict(kcal=0, protein=0, fat=0, carb=0)
    for p in plan:
        if p['weekday'] == d:
            r = next(x for x in recipes if x['id'] == p['recipe_id'])
            for k, v in macros(r['items']).items(): tot[k] += v
    print(f'day {d}: ' + ', '.join(f'{k} {round(v)}' for k, v in tot.items()))

# ---------- exercises & workouts ----------
E = lambda id, name, cat, measure, rest, img, tips: dict(id=id, name=name, category=cat, measure=measure,
        rest_seconds=rest, demo_frames=[f'ex/{img}/0.jpg', f'ex/{img}/1.jpg'] if img else [], tips_az=tips)
exercises = [
 E('leg_press','Leg Press','guc','set_tekrar',90,'Leg_Press',['Bel və omba oturacaqdan qalxmasın','Dizlər ayaq ucları istiqamətində','Yuxarıda dizi tam kilidləmə']),
 E('chest_press','Chest Press','guc','set_tekrar',90,'Leverage_Chest_Press',['Kürəkləri arxaya sıx, sinə önə','Dirsəklər çiyindən bir az aşağı','Geri gəlişi 2 saniyəyə yavaş et']),
 E('lat_pulldown','Lat Pulldown','guc','set_tekrar',90,'Wide-Grip_Lat_Pulldown',['Barı sinənin yuxarısına çək','Arxaya çox əyilmə, gövdə sabit','Dirsəkləri aşağı və geri apar']),
 E('leg_curl','Leg Curl','guc','set_tekrar',60,'Seated_Leg_Curl',['Oturacağa tam söykən','Dabanları aşağı və geri çək','Qayıdışda çəkini atma, idarə et']),
 E('shoulder_press','Shoulder Press','guc','set_tekrar',90,'Leverage_Shoulder_Press',['Beli söykənəcəkdən ayırma','Yuxarıda qolları tam kilidləmə','Qarnını gərgin saxla']),
 E('cable_crunch','Cable Crunch','qarin','set_tekrar',60,'Cable_Crunch',['Omba yerində qalsın, hərəkət qarından gəlsin','Dirsəkləri dizlərə doğru apar','Yüngül çəki ilə başla']),
 E('plank','Plank','qarin','saniye',60,'Plank',['Başdan dabana düz xətt','Ombanı qaldırma və endirmə','Qarnı və ombanı sıx, nəfəsi saxlama']),
 E('goblet_squat','Goblet Squat','guc','set_tekrar',90,'Goblet_Squat',['Hanteli sinəyə yaxın tut','Dabanlar yerdən qalxmasın','Dizlər ayaq ucları istiqamətində açılsın']),
 E('seated_cable_row','Seated Cable Row','guc','set_tekrar',90,'Seated_Cable_Rows',['Gövdə dik, arxaya yellənmə','Dirsəkləri bədənə yaxın çək','Sonda kürəkləri bir-birinə sıx']),
 E('incline_chest_press','Incline Chest Press','guc','set_tekrar',90,'Leverage_Incline_Chest_Press',['Kürəklər söykənəcəyə sıxılı','Dirsəklər çiyindən bir az aşağı','Yavaş geri gəl, çəkini atma']),
 E('romanian_deadlift','Romanian Deadlift (hantel)','guc','set_tekrar',90,'Stiff-Legged_Dumbbell_Deadlift',['Bel düz, hərəkət ombadan gəlir','Hantellər budlara yaxın enir','Arxa budda dartılma hiss edəndə qalx']),
 E('leg_extension','Leg Extension','guc','set_tekrar',60,'Leg_Extensions',['Dizin oxu trenajorun oxu ilə üst-üstə','Yuxarıda 1 saniyə saxla','Yavaş en, çəkini atma']),
 E('db_biceps_curl','DB Biceps Curl','guc','set_tekrar',60,'Dumbbell_Bicep_Curl',['Dirsəklər bədənə yaxın, yerində','Gövdəni yelləmə','Aşağıda qolu tam aç']),
 E('triceps_pushdown','Triceps Pushdown','guc','set_tekrar',60,'Triceps_Pushdown',['Dirsəklər bədənə yapışıq','Aşağıda qolu tam aç','Çiyinləri qaldırma']),
 E('dead_bug','Dead Bug','qarin','set_tekrar',60,'Dead_Bug',['Bel yerə yapışıq qalsın','Qarşı qol və ayaq birlikdə uzanır','Yavaş, nəfəsi verərək']),
 E('reverse_crunch','Reverse Crunch','qarin','set_tekrar',60,'Reverse_Crunch',['Ombanı qarın gücü ilə qaldır','Ayaqları yelləmə','Aşağı yavaş en']),
 E('treadmill','Qaçış yolu','kardio','deqiqe',0,'Walking_Treadmill',['Rahat danışa biləcəyin temp','İlk 2 həftə meyil 0–3%','5 dəq isinmə, 5 dəq soyuma']),
 E('brisk_walk','Tempolu gəzinti','gezinti','deqiqe',0,None,['Sürətli, amma danışa biləcəyin temp','Çiyinlər rahat, qollar yellənsin','Su götür']),
 E('outdoor_walk','Açıq havada gəzinti','gezinti','deqiqe',0,None,['Rahat temp','Telefonsuz 10 dəqiqə də olar','Havaya uyğun geyin']),
 E('walk','Gəzinti','gezinti','deqiqe',0,None,['Rahat temp','Addım sayına bax','İstəsən velotrenajor ilə əvəz et']),
 E('bird_dog','Bird Dog','qarin','set_tekrar',45,None,['Bel düz, qarın gərgin','Qarşı qol və ayaq birlikdə uzanır','Hər tərəfdə 1 saniyə saxla']),
 E('stretch','Dartınma','mobilizasiya','deqiqe',0,None,['Hər dartınma 20–30 saniyə','Ağrı yox, yüngül dartılma','Nəfəsi saxlama']),
 E('mobility','Bel, omba və ayaq mobilizasiyası','mobilizasiya','deqiqe',0,None,['Yavaş, nəzarətli hərəkət','Ağrı olan hərəkəti keç','Nəfəsi saxlama']),
 E('bike','Velotrenajor','kardio','deqiqe',0,None,['İstəyə görə','Rahat temp','Gəzinti əvəzinə ola bilər']),
]
def I(ex, sets=None, rmin=None, rmax=None, smin=None, smax=None, minutes=None, mmax=None, note=None):
    return dict(exercise_id=ex, sets=sets, reps_min=rmin, reps_max=rmax, sec_min=smin, sec_max=smax,
                minutes=minutes, minutes_max=mmax, note=note)
A = [I('leg_press',3,12,12,note='İlk 2 həftə: hər setdə 3 təkrar ehtiyat qalsın'), I('chest_press',3,12,12), I('lat_pulldown',3,12,12),
     I('leg_curl',2,15,15), I('shoulder_press',2,12,12), I('cable_crunch',3,12,15), I('plank',3,smin=20,smax=40)]
templates = [
 dict(id='A1', code='A', weekday=1, name='Full Body A + qarın', kind='guc', items=A + [I('treadmill', minutes=20, note='meyil 0–3%')]),
 dict(id='YA1', code='YA', weekday=2, name='Yüngül aktivlik', kind='yungul', items=[I('brisk_walk', minutes=30, mmax=40), I('dead_bug',3,10,10), I('bird_dog',2,10,10), I('stretch', minutes=5, mmax=10)]),
 dict(id='B', code='B', weekday=3, name='Full Body B + qarın', kind='guc', items=[I('goblet_squat',3,12,12), I('seated_cable_row',3,12,12), I('incline_chest_press',3,12,12),
     I('romanian_deadlift',3,10,10,note='Yüngül başla'), I('leg_extension',2,15,15), I('db_biceps_curl',2,12,12), I('triceps_pushdown',2,12,12),
     I('dead_bug',3,10,10), I('reverse_crunch',2,12,12), I('treadmill', minutes=20, note='meyil 0–3%')]),
 dict(id='AB', code='AB', weekday=4, name='Aktiv bərpa', kind='yungul', items=[I('outdoor_walk', minutes=30), I('mobility', minutes=10), I('stretch', minutes=5)]),
 dict(id='A2', code='A', weekday=5, name='Full Body A + qarın', kind='guc', items=A + [I('treadmill', minutes=20, mmax=25, note='meyil 0–3%')]),
 dict(id='YA2', code='YA', weekday=6, name='Yüngül aktivlik', kind='yungul', items=[I('walk', minutes=40, mmax=50), I('mobility', minutes=10), I('bike', note='istəyə görə')]),
 dict(id='IS', code='IS', weekday=7, name='Tam istirahət', kind='istirahet', items=[]),
]
for t in templates:
    for i, it in enumerate(t['items']): it['sort'] = i + 1

checkpoints = []
for r in wb['Checkpointlər'].iter_rows(min_row=2, values_only=True):
    if r[1] is None or not isinstance(r[1], (int, float)): continue
    checkpoints.append(dict(sort=len(checkpoints) + 1, label=str(r[0]) if r[0] == 'Final' else f'Checkpoint {r[0]}', target_kg=float(r[1]), reward_text=r[2]))

b = {r[0]: r[1] for r in wb['Başla'].iter_rows(values_only=True) if r[0]}
profile = dict(start_date=str(b['Başlanğıc tarixi'])[:10], start_weight_kg=float(b['Başlanğıc çəki (kq)']),
               target_12w_kg=float(b['12 həftəlik hədəf (kq)']), height_cm=181, sex='kisi', birth_year=2000,
               est_body_fat_pct=float(b['Bədən yağ faizi']) * 100)
goals = dict(kcal=int(b['Kalori hədəfi (kcal)']), kcal_tolerance=int(b['Kalori uyğunluq aralığı ±']),
             protein_g=int(b['Zülal hədəfi (q)']), fat_g=int(b['Yağ hədəfi (q)']), carb_g=int(b['Karbohidrat hədəfi (q)']),
             water_ml=int(float(b['Su hədəfi (L)']) * 1000), water_training_bonus_ml=500, steps=int(b['Addım hədəfi']))

seed = dict(profile=profile, goals=goals, foods=foods, recipes=recipes, meal_plan=plan,
            exercises=exercises, workout_templates=templates, checkpoints=checkpoints)
json.dump(seed, open(os.path.join(ROOT, 'src/data/seed.json'), 'w'), ensure_ascii=False, indent=1)

# ---------- SQL ----------
def q(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return repr(v)
    if isinstance(v, (list, dict)): return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"
L = ['-- AUTO-GENERATED by scripts/build_seed.py from fitness_12hefte.xlsx. Do not edit by hand.', 'begin;',
     'delete from meal_plan_items; delete from recipe_items; delete from recipes; delete from meal_plans;',
     'delete from workout_template_items; delete from workout_templates; delete from exercises; delete from foods;']
for f in foods:
    L.append('insert into foods (id,name,state,kcal_100g,protein_100g,fat_100g,carb_100g,unit_name,unit_grams,is_fruit,note) values (' +
             ','.join(q(f[k]) for k in ['id','name','state','kcal_100g','protein_100g','fat_100g','carb_100g','unit_name','unit_grams','is_fruit','note']) + ');')
for r in recipes:
    L.append(f"insert into recipes (id,name,slot,is_portable) values ({q(r['id'])},{q(r['name'])},{q(r['slot'])},{q(r['is_portable'])});")
    for i, it in enumerate(r['items']):
        L.append(f"insert into recipe_items (recipe_id,food_id,grams,sort) values ({q(r['id'])},{q(it['food_id'])},{q(it['grams'])},{i+1});")
L.append("insert into meal_plans (id,name,is_active,imported_from) values ('xlsx_v1','7 günlük menyu (2300 kcal)',true,'fitness_12hefte.xlsx');")
for p in plan:
    L.append(f"insert into meal_plan_items (meal_plan_id,weekday,slot,recipe_id) values ('xlsx_v1',{p['weekday']},{q(p['slot'])},{q(p['recipe_id'])});")
for e in exercises:
    L.append('insert into exercises (id,name,category,measure,rest_seconds,demo_frames,tips_az) values (' +
             ','.join(q(e[k]) for k in ['id','name','category','measure','rest_seconds','demo_frames','tips_az']) + ');')
for t in templates:
    L.append(f"insert into workout_templates (id,code,weekday,name,kind) values ({q(t['id'])},{q(t['code'])},{t['weekday']},{q(t['name'])},{q(t['kind'])});")
    for it in t['items']:
        L.append('insert into workout_template_items (template_id,exercise_id,sets,reps_min,reps_max,sec_min,sec_max,minutes,minutes_max,note,sort) values (' +
                 ','.join([q(t['id'])] + [q(it[k]) for k in ['exercise_id','sets','reps_min','reps_max','sec_min','sec_max','minutes','minutes_max','note','sort']]) + ');')
L.append('commit;')
open(os.path.join(ROOT, 'supabase/seed.sql'), 'w').write('\n'.join(L) + '\n')
print(len(foods), 'foods', len(recipes), 'recipes', len(plan), 'plan items', len(exercises), 'exercises')
