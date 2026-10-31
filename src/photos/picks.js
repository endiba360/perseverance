// Fotos escogidas a mano entre las crudas más recientes de cada cámara (sols
// 2018–2024, octubre de 2026). Se revisaron una por una: todas a color y con algo
// de Marte que mirar (horizonte, el brazo sobre el suelo, rocas de cerca); se
// descartaron cielo vacío, sol, calibración, miniaturas y franjas recortadas.
// Los datos (sol, fecha, URL) se piden en vivo a la API de la NASA por su id.

// Clave = nombre de la pieza en el modelo 3D (ver rover/rover.js)
export const PHOTO_CAMERAS = {
  Mastcam_Z_cams: {
    label: 'Mastcam-Z',
    role: 'Par estéreo con zoom en el mástil',
    picks: [
      'ZL0_2020_0846263070_193EBY_N0920000ZCAM10053_0480LMJ', // cresta rocosa en el horizonte
      'ZL0_2020_0846263053_193EBY_N0920000ZCAM10053_0480LMJ', // el brazo frente a la cresta
      'ZL0_2020_0846262995_193EBY_N0920000ZCAM10053_0480LMJ', // valle entre lomas
      'ZL0_2023_0846533614_988EBY_N0930000ZCAM04498_1100LMJ', // rocas claras de cerca
      'ZR0_2023_0846534172_973EBY_N0930000ZCAM04499_1100LMJ', // roca grande y fracturada
      'ZR0_2024_0846621585_144EBY_N0930000ZCAM10058_1100LMJ', // losa alargada sobre la arena
    ],
  },
  NavCams: {
    label: 'Navcam',
    role: 'Cámaras de navegación en el mástil',
    picks: [
      'NLF_2022_0846455939_237ECM_N0930000NCAM02022_01_195J', // lomas y el borde del cráter
      'NLF_2022_0846456110_237ECM_N0930000NCAM02022_01_195J', // la cubierta del rover frente a la loma
      'NLF_2022_0846455714_722ECM_N0930000NCAM13022_01_195J', // colina en el horizonte
      'NLF_2023_0846548592_316ECM_N0930000NCAM00347_01_195J', // la torreta del brazo sobre el suelo
      'NLF_2023_0846549056_005ECM_N0930000NCAM00709_05_095J', // el brazo extendido sobre la arena
      'NLF_2023_0846548592_316ECM_N0930000NCAM00347_04_195J', // la sombra de Percy
    ],
  },
  hazcams_front: {
    label: 'Hazcam delantera',
    role: 'Ojo de pez para esquivar obstáculos',
    picks: [
      'FLF_2023_0846549745_302ECM_N0930000FHAZ00206_01_295J', // brazo, rueda y horizonte
      'FLF_2019_0846185639_601ECM_N0920000FHAZ00206_01_295J', // la torreta trabajando sobre una roca
      'FLF_2022_0846447347_237ECM_N0930000FHAZ02008_01_090J', // roca clara junto a la rueda
      'FLF_2022_0846447347_237ECM_N0930000FHAZ02008_02_090J', // la sombra del mástil entre piedras
      'FLF_2018_0846090574_426ECM_N0920000FHAZ02008_02_095J', // roca con la marca blanca de la abrasión
    ],
  },
  WATSON: {
    label: 'WATSON',
    role: 'Cámara de primer plano en la torreta del brazo',
    picks: [
      'SIF_2023_0846549705_738EBY_N0930000SRLC02503_0000LMJ', // roca porosa entera
      'SIF_2023_0846550026_515EBY_N0930000SRLC00630_0000LMJ', // la misma roca a centímetros
      'SIF_2019_0846185766_167EBY_N0920000SRLC00878_0000LMJ', // el agujero de una perforación
      'SIF_2019_0846185600_945EBY_N0920000SRLC02500_0000LMJ', // parche raspado por la abrasión
    ],
  },
};
