// Reseptlərin hazırlanması: sadə dildə, evdə bişirən üçün.
// Açar = resept id (sonundakı _2, _3 atılır). Çəkilər reseptin ərzaq siyahısındadır.
export interface RecipeGuide { time: string; steps: string[]; tip?: string }

const FRUIT: RecipeGuide = { time: '2 dəq', steps: ['Meyvəni yu, lazım olsa qabığını soy.', 'Çəkini tərəzidə bir dəfə yoxla, sonra gözəyarı da olar.'] }

const G: Record<string, RecipeGuide> = {
  toyuq_filesi_qatiq_qarisigi: {
    time: '25 dəq',
    steps: [
      'Toyuq filesini duz və istiotla ovxala.',
      'Qızmış tavada (yağ varsa, siyahıdakı qədər) hər üzünü 6–7 dəqiqə bişir, içi ağ olsun.',
      'Xiyarı xırda doğra, qatığa qat, limon şirəsi və doğranmış göyərti əlavə et, bir az duz.',
      'Toyuğu dilimlə, qatıq qarışığı ilə ver.',
    ],
    tip: 'Axşam yeməyi yüngüldür: çörək, düyü, kartof yoxdur.',
  },
  toyuq_sote_duyu_salat: {
    time: '35 dəq',
    steps: [
      'Düyünü 2–3 dəfə yu, 2 ölçü suda, qapağı bağlı 15–18 dəqiqə zəif odda bişir.',
      'Toyuğu tikələrə doğra, duz, istiot, paprika ilə qarışdır.',
      'Yağı tavada qızdır, soğanı 3 dəqiqə qovur, toyuğu əlavə et, 7 dəqiqə bişir.',
      'Doğranmış bibər və pomidoru əlavə et, 5 dəqiqə də saxla.',
      'Xiyarı ayrıca qaba doğra, düyü və sote ilə ver.',
    ],
  },
  yulaf_siyigi_kesmik_yumurta: {
    time: '15 dəq',
    steps: [
      'Südü qazanda qızdır, yulafı tök, qarışdıraraq 5–7 dəqiqə bişir.',
      'Yumurtaları qaynar suda 8–9 dəqiqə bişir, soyuq suya qoy, soy.',
      'Kəsmiyi ayrıca qabda ver və ya sıyığın üstünə qoy.',
    ],
    tip: 'Şəkər əvəzinə bir az darçın olar.',
  },
  toyuq_sis_terevez_qatiq: {
    time: '30 dəq',
    steps: [
      'Toyuğu iri tikələrə doğra, duz, istiot, 1 qaşıq qatıqla 15 dəqiqə saxla.',
      'Bibər və pomidoru iri doğra, toyuqla növbə ilə şişə keçir.',
      'Yağlanmış qril tavada və ya 220°C sobada hər tərəfini 5–6 dəqiqə bişir.',
      'Qalan qatıqla ver.',
    ],
  },
  sobada_toyuq_kartof_salat: {
    time: '50 dəq',
    steps: [
      'Sobanı 200°C-yə qızdır.',
      'Kartofu yu, dilimlə, yağın yarısı, duz və istiotla qarışdır.',
      'Toyuğu duz, istiot, paprika ilə ovxala, qalan yağla yağla.',
      'Hamısını bir sinidə 35–40 dəqiqə bişir, kartof qızarana qədər.',
      'Pomidor, xiyar və göyərtidən salat hazırla, yağsız ver.',
    ],
  },
  omlet_pendir_corek_terevez: {
    time: '10 dəq',
    steps: [
      'Yumurtaları çalxala, bir az duz.',
      'Yapışmayan tavada yağsız və ya bir neçə damla yağla 3–4 dəqiqə bişir.',
      'Pendir, çörək, doğranmış pomidor və xiyarla ver. Kəsmik ayrıca.',
    ],
  },
  toyuq_kotleti_qarabasaq_salat: {
    time: '40 dəq',
    steps: [
      'Qarabaşağı yu, 2 ölçü suda 15–20 dəqiqə bişir.',
      'Toyuğu və soğanı ət maşınından keçir, yumurta, duz, istiot qat.',
      'Yaş əllə kotletlər düzəlt.',
      'Tavada yağı qızdır, hər üzünü 4–5 dəqiqə qızart, sonra qapağı bağlı 5 dəqiqə zəif odda saxla.',
      'Pomidor-xiyar salatı ilə ver.',
    ],
  },
  yulaf_sud_kesmik_nar: {
    time: '10 dəq',
    steps: [
      'Südü qızdır, yulafı tök, 5 dəqiqə bişir.',
      'Kəsmiyi qarışdır və ya üstünə qoy.',
      'Nar dənələrini üstünə səp.',
    ],
  },
  toyuq_sote_yagsiz_qatiq: {
    time: '25 dəq',
    steps: [
      'Toyuğu nazik zolaqlarla doğra, duz və istiot vur.',
      'Yağı tavada qızdır, toyuğu 6–7 dəqiqə bişir.',
      'Bibər və pomidoru əlavə et, 5 dəqiqə də bişir.',
      'Qatıqla ver.',
    ],
  },
  toyuq_sis_duyu_salat: {
    time: '40 dəq',
    steps: [
      'Düyünü yu, 2 ölçü suda qapağı bağlı 15–18 dəqiqə bişir.',
      'Toyuğu iri tikələrə doğra, rəndələnmiş soğan, duz, istiotla 15 dəqiqə saxla.',
      'Şişə keçir, yağlanmış qril tavada hər tərəfini 5–6 dəqiqə bişir.',
      'Pomidor-xiyar salatını ayrıca qabda ver.',
    ],
  },
  pendir_yumurta_corek_terevez: {
    time: '12 dəq',
    steps: [
      'Yumurtaları qaynar suda 8–9 dəqiqə bişir, soyuq suya qoy, soy.',
      'Pomidor, xiyar və bibəri doğra.',
      'Pendir, çörək və kəsmiklə ver.',
    ],
  },
  sobada_toyuq_qarabasaq_salat: {
    time: '45 dəq',
    steps: [
      'Sobanı 200°C-yə qızdır. Toyuğu duz, istiot, paprika və yağla ovxala.',
      'Sinidə 25–30 dəqiqə bişir, içi ağ olsun.',
      'Bu vaxt qarabaşağı yu və 2 ölçü suda 15–20 dəqiqə bişir.',
      'Pomidor, xiyar və göyərtidən salat hazırla.',
    ],
  },
  toyuq_sis_qatiq_qarisigi: {
    time: '30 dəq',
    steps: [
      'Toyuğu iri tikələrə doğra, duz və istiotla ovxala.',
      'Şişə keçir, yağlanmış qril tavada hər tərəfini 5–6 dəqiqə bişir.',
      'Xiyarı xırda doğra, qatığa qat, doğranmış göyərti və bir az duz əlavə et.',
      'Şişi qatıq qarışığı ilə ver.',
    ],
  },
  toyuq_kotleti_kartof_puresi_salat: {
    time: '45 dəq',
    steps: [
      'Kartofu soy, doğra, duzlu suda 20 dəqiqə bişir. Suyunu süz, isti südlə əz.',
      'Toyuğu və soğanı ət maşınından keçir, duz və istiot qat, kotletlər düzəlt.',
      'Tavada yağı qızdır, hər üzünü 4–5 dəqiqə qızart, sonra qapağı bağlı 5 dəqiqə saxla.',
      'Pomidor-xiyar salatı ilə ver.',
    ],
    tip: 'Püreyə yağ qatma, süd bəs edir.',
  },
  omlet_pendir_corek_kesmik: {
    time: '10 dəq',
    steps: [
      'Bibəri və pomidoru xırda doğra, yapışmayan tavada 2 dəqiqə qızdır.',
      'Çalxalanmış yumurtaları üstünə tök, 3–4 dəqiqə bişir.',
      'Pendir, çörək və kəsmiklə ver.',
    ],
  },
  sobada_toyuq_terevez_qatiq: {
    time: '40 dəq',
    steps: [
      'Sobanı 200°C-yə qızdır.',
      'Toyuğu, iri doğranmış bibər və pomidoru yağ, duz, istiotla qarışdır.',
      'Sinidə 25–30 dəqiqə bişir.',
      'Qatıqla ver.',
    ],
  },
  yulaf_sud_kesmik_alma: {
    time: '10 dəq',
    steps: [
      'Südü qızdır, yulafı tök, 5 dəqiqə bişir.',
      'Almanı xırda doğra və ya rəndələ, sıyığa qat. Bir az darçın olar.',
      'Kəsmiklə ver.',
    ],
  },
}

export function guideFor(recipeId: string, slot: string): RecipeGuide {
  if (slot === 'ara_1' || slot === 'ara_2') return FRUIT
  return G[recipeId.replace(/_\d+$/, '')] ?? { time: '—', steps: ['Ərzaqları siyahıdakı çəki ilə hazırla.'] }
}
