// import-exercises.cjs — Run: node import-exercises.cjs > exercises-import.sql
const https = require('https')

const MUSCLE_MAP = {
  'abdominals': 'Abdominaux', 'abductors': 'Abducteurs', 'adductors': 'Adducteurs',
  'biceps': 'Biceps', 'calves': 'Mollets', 'chest': 'Pectoraux',
  'forearms': 'Avant-bras', 'glutes': 'Fessiers', 'hamstrings': 'Ischio-jambiers',
  'lats': 'Dos', 'lower back': 'Bas du dos', 'middle back': 'Milieu du dos',
  'neck': 'Cou', 'quadriceps': 'Quadriceps', 'shoulders': 'Épaules',
  'traps': 'Trapèzes', 'triceps': 'Triceps'
}

const EQUIP_MAP = {
  'barbell': 'Barre', 'dumbbell': 'Haltères', 'cable': 'Poulie',
  'machine': 'Machine', 'body only': 'Poids de corps', 'kettlebells': 'Kettlebell',
  'bands': 'Élastique', 'exercise ball': 'Swiss ball', 'foam roll': 'Foam roller',
  'e-z curl bar': 'Barre EZ', 'medicine ball': 'Medecine ball',
  'other': 'Autre', null: 'Autre'
}

const TR = [
  [/\bLie (down |flat )?on (the |a )?flat bench/gi, 'Allongez-vous sur un banc plat'],
  [/\bLie (down |flat )?on (the |a )?incline bench/gi, 'Allongez-vous sur un banc incline'],
  [/\bLie (down |flat )?on (the |a )?decline bench/gi, 'Allongez-vous sur un banc decline'],
  [/\bLie (down |flat )?(on )?(the |your |a )?(floor|ground|back)/gi, 'Allongez-vous au sol'],
  [/\bSit (down )?(on )?(an? )?(exercise |incline )?bench/gi, 'Asseyez-vous sur un banc'],
  [/\bStand (up )?(straight )?with/gi, 'Tenez-vous debout avec'],
  [/\bThis will be your starting position\.?/gi, 'Position de depart.'],
  [/\bThis is (the |your )?starting position\.?/gi, 'Position de depart.'],
  [/\bReturn to (the )?starting position/gi, 'Revenez en position de depart'],
  [/\bRepeat for the recommended (amount|number) of repetitions\.?/gi, 'Repetez selon le nombre souhaite.'],
  [/\bRepeat (for |on )?the (other|opposite) (side|leg|arm)/gi, 'Repetez de l autre cote'],
  [/\bRepeat/gi, 'Repetez'],
  [/\bHold (the )?(contracted |stretched )?(position )?for (a |one )?second/gi, 'Maintenez 1 seconde'],
  [/\bAfter a (brief |second |short )?pause,? ?/gi, 'Apres une pause, '],
  [/\bSlowly /gi, 'Lentement, '],
  [/\bBreathe out/gi, 'Expirez'],
  [/\bBreathe in/gi, 'Inspirez'],
  [/\bbreathe out/g, 'expirez'],
  [/\bbreathe in/g, 'inspirez'],
  [/\bas you breathe out/gi, 'en expirant'],
  [/\bas you breathe in/gi, 'en inspirant'],
  [/\bas you exhale/gi, 'en expirant'],
  [/\bas you inhale/gi, 'en inspirant'],
  [/\bshoulder blades?\b/gi, 'omoplates'],
  [/\bshoulders?\b/gi, 'epaules'],
  [/\belbows?\b/gi, 'coudes'],
  [/\bwrists?\b/gi, 'poignets'],
  [/\bknees?\b/gi, 'genoux'],
  [/\btorso\b/gi, 'torse'],
  [/\bchest\b/gi, 'poitrine'],
  [/\bthighs?\b/gi, 'cuisses'],
  [/\bcalves\b/gi, 'mollets'],
  [/\bglutes?\b/gi, 'fessiers'],
  [/\bhamstrings?\b/gi, 'ischio-jambiers'],
  [/\bbiceps?\b/gi, 'biceps'],
  [/\btriceps?\b/gi, 'triceps'],
  [/\babs\b/gi, 'abdominaux'],
  [/\bcore\b/gi, 'sangle abdominale'],
  [/\bdumbbells?\b/gi, 'halteres'],
  [/\bbarbell\b/gi, 'barre'],
  [/\bkettlebells?\b/gi, 'kettlebells'],
  [/\bbench\b/gi, 'banc'],
  [/\bweights?\b/gi, 'poids'],
  [/\boverhand grip/gi, 'prise en pronation'],
  [/\bunderhand grip/gi, 'prise en supination'],
  [/\bmedium (width )?grip/gi, 'prise moyenne'],
  [/\bwide grip/gi, 'prise large'],
  [/\bnarrow grip/gi, 'prise serree'],
  [/\bshoulder[- ]?width/gi, 'largeur d epaules'],
  [/\bat arms? length/gi, 'bras tendus'],
  [/\bfully contracted/gi, 'entierement contracte'],
  [/\bat all times/gi, 'en permanence'],
  [/\bstarting position/gi, 'position de depart'],
  [/\bTip: /gi, 'Conseil : '],
  [/\bthe movement/gi, 'le mouvement'],
  [/\bthe floor\b/gi, 'le sol'],
  [/\byour body\b/gi, 'votre corps'],
  [/\byour back\b/gi, 'votre dos'],
  [/\byour legs\b/gi, 'vos jambes'],
  [/\byour arms\b/gi, 'vos bras'],
  [/\byour feet\b/gi, 'vos pieds'],
  [/\byour hands\b/gi, 'vos mains'],
]

const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'
function esc(s) { return (s||'').replace(/'/g, "''").replace(/\n/g, ' ').replace(/\r/g, '') }
function tr(text) { let r = text; for (const [p, rep] of TR) r = r.replace(p, rep); return r }
function fetch(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, r => {
      if (r.statusCode === 301 || r.statusCode === 302) return fetch(r.headers.location).then(res).catch(rej)
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d))
    }).on('error', rej)
  })
}

async function main() {
  console.error('Downloading 800+ exercises...')
  const raw = await fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json')
  const exercises = JSON.parse(raw)
  console.error(`${exercises.length} exercises found. Translating...`)

  console.log('-- ' + exercises.length + ' exercises (free-exercise-db, Public Domain)')

  const levelFr = { beginner: 'Debutant', intermediate: 'Intermediaire', expert: 'Avance' }
  let n = 0
  for (const ex of exercises) {
    const name = esc(ex.name)
    const muscle = MUSCLE_MAP[ex.primaryMuscles?.[0]] || 'Autre'
    const equipment = EQUIP_MAP[ex.equipment] || 'Autre'
    const steps = (ex.instructions || []).map((s, i) => `${i+1}. ${tr(s)}`).join(' ')
    const desc = esc(steps)
    const gif = esc(ex.images?.[0] ? IMG_BASE + ex.images[0] : '')
    const sec = (ex.secondaryMuscles || []).map(m => MUSCLE_MAP[m] || m).filter(Boolean)
    const tips = esc(sec.length ? `Muscles secondaires : ${sec.join(', ')}. Niveau : ${levelFr[ex.level]||'Intermediaire'}.` : `Niveau : ${levelFr[ex.level]||'Intermediaire'}.`)

    console.log(`INSERT INTO public.exercises (name, muscle_group, equipment, description, tips, gif_url) VALUES ('${name}', '${muscle}', '${equipment}', '${desc}', '${tips}', '${gif}') ON CONFLICT DO NOTHING;`)
    n++
  }
  console.error(`Done! ${n} exercises.`)
}
main().catch(e => console.error('Error:', e))
