'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'en' | 'fr' | 'es';

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
];

type Dict = Record<string, string>;

/**
 * Translation dictionaries. English is the source of truth; any key missing in
 * fr/es falls back to English, so partial translation never breaks the UI.
 */
const en: Dict = {
  'app.tagline': 'Clinical AI · v2.1',
  'nav.main': 'Main',
  'nav.reports': 'Reports',
  'nav.predict': 'Detection',
  'nav.dashboard': 'Dashboard',
  'nav.patients': 'Patient Records',
  'nav.analytics': 'Analytics',
  'nav.generateReports': 'Generate Reports',
  'nav.settings': 'Settings',
  'nav.signOut': 'Sign out',
  'nav.language': 'Language',

  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.fullName': 'Full name',
  'auth.role': 'Role',
  'auth.role.admin': 'Admin',
  'auth.role.doctor': 'Doctor',
  'auth.role.nurse': 'Nurse',
  'auth.noAccount': "Don't have an account?",
  'auth.haveAccount': 'Already have an account?',
  'auth.signInSubtitle': 'Sign in to your clinical workspace',
  'auth.signUpSubtitle': 'Create your clinical account',
  'auth.checkEmail': 'Check your email to confirm your account, then sign in.',
  'auth.signingIn': 'Signing in…',
  'auth.creating': 'Creating account…',

  'predict.title': 'Risk Assessment',
  'predict.subtitle': 'Input routine lab values for AI prediction',
  'predict.reset': 'Reset',
  'predict.uploadPdf': 'Upload Lab PDF',
  'predict.run': 'Run AI Prediction',
  'predict.analyzing': 'Analyzing…',
  'predict.clear': 'Clear Form',
  'predict.complete': 'Prediction complete',
  'predict.exportPdf': 'Export PDF',
  'predict.demographics': 'Demographics',
  'predict.vitals': 'Vital Signs',
  'predict.labs': 'Laboratory Biomarkers',
  'predict.comorbidities': 'Comorbidities',
  'predict.recent': 'Recent Predictions',

  'result.title': 'Clinical Assessment',
  'result.riskScore': 'Kidney Disease Risk Score',
  'result.action': 'Recommended Action',
  'result.probability': 'Probability Breakdown',
  'result.threshold': 'Screening threshold',
  'result.screening': 'Screening result',
  'result.screeningHint':
    'Secondary binary flag set at the F1-optimal threshold. Clinical guidance follows the risk level above.',
  'result.estimated': 'Some values were estimated',
  'result.estimatedHint':
    'Not provided, so filled with NHANES population averages. Supply them for a more accurate result:',
  'result.kdRisk': 'KD Risk',
  'result.noKdRisk': 'No KD Risk',

  'risk.Low Risk': 'Low Risk',
  'risk.Moderate Risk': 'Moderate Risk',
  'risk.High Risk': 'High Risk',
  'risk.Critical Risk': 'Critical Risk',

  'urgency.Routine': 'Routine follow-up',
  'urgency.Monitor': 'Monitor closely',
  'urgency.Refer': 'Refer to nephrology',
  'urgency.Urgent': 'Urgent referral',

  'action.Low Risk':
    'No strong indicators of kidney disease detected. Routine follow-up recommended. Reassess in 12 months.',
  'action.Moderate Risk':
    'Some clinical markers present. Borderline profile. Repeat laboratory tests in 3 months. Monitor blood pressure and diabetes control closely.',
  'action.High Risk':
    'Clinical profile strongly suggestive of kidney disease. Nephrology referral recommended. Full renal function workup advised.',
  'action.Critical Risk':
    'Clinical profile highly consistent with kidney disease. Urgent nephrology referral required. Immediate further evaluation necessary.',

  'drivers.title': 'What Drove This Result',
  'drivers.subtitle': 'Feature contributions',
  'drivers.loading': 'Analysing contributions…',
  'drivers.unavailable': 'Explanations are unavailable on this server.',
  'drivers.increases': 'Increases risk',
  'drivers.reduces': 'Reduces risk',
  'drivers.topDrivers': 'Top drivers',
  'drivers.note':
    'Shows which measurements pushed this prediction up or down. Reflects model reasoning, not clinical causation.',
  'drivers.bothAgree': 'Both methods agree',
  'drivers.agreeHint': 'Independent methods highlighting the same drivers is a good sign.',
  'drivers.limeNote':
    'LIME fits a simple local model around this patient and reports the rule each measurement triggered. It approximates the model locally, so it may rank features differently from SHAP.',
  'drivers.uploadPdf': 'Upload Lab PDF',
  'pdf.extracting': 'Reading lab report…',
  'pdf.verify': 'Review every value against the original report before running the prediction.',
  'pdf.extracted': 'Extracted {n} value(s).',
  'pdf.missing': 'Could not find: {fields}. Please enter them manually.',

  'field.patientName': 'Patient Name',
  'field.age': 'Age',
  'field.gender': 'Gender',
  'field.male': 'Male',
  'field.female': 'Female',

  'stats.today': 'Assessments Today',
  'stats.todaySub': 'recorded since midnight',
  'stats.referral': 'Needs Referral',
  'stats.referralSub': 'high or critical risk',
  'stats.patients': 'Patients Tracked',
  'stats.patientsSub': 'with saved history',
  'stats.sensitivity': 'Detection Rate',
  'stats.sensitivitySub': 'catches ~3 in 4 cases',

  'status.online': 'API Online',
  'status.offline': 'API Offline',
  'status.checking': 'Checking',

  'common.loading': 'Loading…',
  'common.viewAll': 'View All',
  'common.none': 'No records yet.',
};

const fr: Dict = {
  'app.tagline': 'IA Clinique · v2.1',
  'nav.main': 'Principal',
  'nav.reports': 'Rapports',
  'nav.predict': 'Détection',
  'nav.dashboard': 'Tableau de bord',
  'nav.patients': 'Dossiers patients',
  'nav.analytics': 'Analytique',
  'nav.generateReports': 'Générer des rapports',
  'nav.settings': 'Paramètres',
  'nav.signOut': 'Se déconnecter',
  'nav.language': 'Langue',

  'auth.signIn': 'Se connecter',
  'auth.signUp': 'Créer un compte',
  'auth.email': 'E-mail',
  'auth.password': 'Mot de passe',
  'auth.fullName': 'Nom complet',
  'auth.role': 'Rôle',
  'auth.role.admin': 'Administrateur',
  'auth.role.doctor': 'Médecin',
  'auth.role.nurse': 'Infirmier·ère',
  'auth.noAccount': 'Pas encore de compte ?',
  'auth.haveAccount': 'Vous avez déjà un compte ?',
  'auth.signInSubtitle': 'Connectez-vous à votre espace clinique',
  'auth.signUpSubtitle': 'Créez votre compte clinique',
  'auth.checkEmail': 'Vérifiez votre e-mail pour confirmer votre compte, puis connectez-vous.',
  'auth.signingIn': 'Connexion…',
  'auth.creating': 'Création du compte…',

  'predict.title': 'Évaluation du risque',
  'predict.subtitle': 'Saisissez les valeurs de laboratoire pour la prédiction par IA',
  'predict.reset': 'Réinitialiser',
  'predict.uploadPdf': 'Importer un PDF de labo',
  'predict.run': 'Lancer la prédiction IA',
  'predict.analyzing': 'Analyse…',
  'predict.clear': 'Effacer le formulaire',
  'predict.complete': 'Prédiction terminée',
  'predict.exportPdf': 'Exporter en PDF',
  'predict.demographics': 'Démographie',
  'predict.vitals': 'Signes vitaux',
  'predict.labs': 'Biomarqueurs de laboratoire',
  'predict.comorbidities': 'Comorbidités',
  'predict.recent': 'Prédictions récentes',

  'result.title': 'Évaluation clinique',
  'result.riskScore': 'Score de risque de maladie rénale',
  'result.action': 'Conduite recommandée',
  'result.probability': 'Répartition des probabilités',
  'result.threshold': 'Seuil de dépistage',
  'result.screening': 'Résultat du dépistage',
  'result.screeningHint':
    'Indicateur binaire secondaire fixé au seuil optimal F1. La conduite clinique suit le niveau de risque ci-dessus.',
  'result.estimated': 'Certaines valeurs ont été estimées',
  'result.estimatedHint':
    'Non renseignées, donc remplacées par les moyennes de population NHANES. Renseignez-les pour un résultat plus précis :',
  'result.kdRisk': 'Risque rénal',
  'result.noKdRisk': 'Pas de risque rénal',

  'risk.Low Risk': 'Risque faible',
  'risk.Moderate Risk': 'Risque modéré',
  'risk.High Risk': 'Risque élevé',
  'risk.Critical Risk': 'Risque critique',

  'urgency.Routine': 'Suivi de routine',
  'urgency.Monitor': 'Surveillance rapprochée',
  'urgency.Refer': 'Orienter vers la néphrologie',
  'urgency.Urgent': 'Orientation urgente',

  'action.Low Risk':
    'Aucun indicateur marqué de maladie rénale détecté. Suivi de routine recommandé. Réévaluation dans 12 mois.',
  'action.Moderate Risk':
    'Certains marqueurs cliniques sont présents. Profil limite. Répéter les analyses de laboratoire dans 3 mois. Surveiller étroitement la tension artérielle et le contrôle du diabète.',
  'action.High Risk':
    'Profil clinique fortement évocateur d’une maladie rénale. Orientation vers un néphrologue recommandée. Bilan rénal complet conseillé.',
  'action.Critical Risk':
    'Profil clinique hautement compatible avec une maladie rénale. Orientation urgente vers un néphrologue requise. Évaluation complémentaire immédiate nécessaire.',

  'drivers.title': 'Facteurs déterminants du résultat',
  'drivers.subtitle': 'Contributions des variables',
  'drivers.loading': 'Analyse des contributions…',
  'drivers.unavailable': 'Les explications ne sont pas disponibles sur ce serveur.',
  'drivers.increases': 'Augmente le risque',
  'drivers.reduces': 'Réduit le risque',
  'drivers.topDrivers': 'Facteurs principaux',
  'drivers.note':
    'Indique quelles mesures ont fait monter ou baisser cette prédiction. Reflète le raisonnement du modèle, non une causalité clinique.',
  'drivers.bothAgree': 'Les deux méthodes concordent',
  'drivers.agreeHint': 'Deux méthodes indépendantes qui pointent les mêmes facteurs est un bon signe.',
  'drivers.limeNote':
    "LIME ajuste un modèle local simple autour de ce patient et indique la règle déclenchée par chaque mesure. Il s'agit d'une approximation locale : le classement peut différer de SHAP.",
  'drivers.uploadPdf': 'Importer un PDF de labo',
  'pdf.extracting': 'Lecture du rapport de laboratoire…',
  'pdf.verify': 'Vérifiez chaque valeur par rapport au rapport original avant de lancer la prédiction.',
  'pdf.extracted': '{n} valeur(s) extraite(s).',
  'pdf.missing': 'Introuvable : {fields}. Veuillez les saisir manuellement.',

  'field.patientName': 'Nom du patient',
  'field.age': 'Âge',
  'field.gender': 'Sexe',
  'field.male': 'Homme',
  'field.female': 'Femme',

  'stats.today': 'Évaluations aujourd’hui',
  'stats.todaySub': 'depuis minuit',
  'stats.referral': 'À orienter',
  'stats.referralSub': 'risque élevé ou critique',
  'stats.patients': 'Patients suivis',
  'stats.patientsSub': 'avec historique enregistré',
  'stats.sensitivity': 'Taux de détection',
  'stats.sensitivitySub': 'détecte ~3 cas sur 4',

  'status.online': 'API en ligne',
  'status.offline': 'API hors ligne',
  'status.checking': 'Vérification',

  'common.loading': 'Chargement…',
  'common.viewAll': 'Voir tout',
  'common.none': 'Aucun enregistrement.',
};

const es: Dict = {
  'app.tagline': 'IA Clínica · v2.1',
  'nav.main': 'Principal',
  'nav.reports': 'Informes',
  'nav.predict': 'Detección',
  'nav.dashboard': 'Panel',
  'nav.patients': 'Registros de pacientes',
  'nav.analytics': 'Analítica',
  'nav.generateReports': 'Generar informes',
  'nav.settings': 'Configuración',
  'nav.signOut': 'Cerrar sesión',
  'nav.language': 'Idioma',

  'auth.signIn': 'Iniciar sesión',
  'auth.signUp': 'Crear cuenta',
  'auth.email': 'Correo electrónico',
  'auth.password': 'Contraseña',
  'auth.fullName': 'Nombre completo',
  'auth.role': 'Rol',
  'auth.role.admin': 'Administrador',
  'auth.role.doctor': 'Médico',
  'auth.role.nurse': 'Enfermero/a',
  'auth.noAccount': '¿No tienes una cuenta?',
  'auth.haveAccount': '¿Ya tienes una cuenta?',
  'auth.signInSubtitle': 'Inicia sesión en tu espacio clínico',
  'auth.signUpSubtitle': 'Crea tu cuenta clínica',
  'auth.checkEmail': 'Revisa tu correo para confirmar la cuenta y luego inicia sesión.',
  'auth.signingIn': 'Iniciando sesión…',
  'auth.creating': 'Creando cuenta…',

  'predict.title': 'Evaluación de riesgo',
  'predict.subtitle': 'Introduce los valores de laboratorio para la predicción por IA',
  'predict.reset': 'Restablecer',
  'predict.uploadPdf': 'Subir PDF de laboratorio',
  'predict.run': 'Ejecutar predicción IA',
  'predict.analyzing': 'Analizando…',
  'predict.clear': 'Borrar formulario',
  'predict.complete': 'Predicción completada',
  'predict.exportPdf': 'Exportar PDF',
  'predict.demographics': 'Datos demográficos',
  'predict.vitals': 'Signos vitales',
  'predict.labs': 'Biomarcadores de laboratorio',
  'predict.comorbidities': 'Comorbilidades',
  'predict.recent': 'Predicciones recientes',

  'result.title': 'Evaluación clínica',
  'result.riskScore': 'Puntuación de riesgo de enfermedad renal',
  'result.action': 'Conducta recomendada',
  'result.probability': 'Desglose de probabilidad',
  'result.threshold': 'Umbral de cribado',
  'result.screening': 'Resultado del cribado',
  'result.screeningHint':
    'Indicador binario secundario fijado en el umbral óptimo de F1. La orientación clínica sigue el nivel de riesgo anterior.',
  'result.estimated': 'Algunos valores fueron estimados',
  'result.estimatedHint':
    'No se proporcionaron, por lo que se completaron con promedios poblacionales de NHANES. Indíquelos para obtener un resultado más preciso:',
  'result.kdRisk': 'Riesgo renal',
  'result.noKdRisk': 'Sin riesgo renal',

  'risk.Low Risk': 'Riesgo bajo',
  'risk.Moderate Risk': 'Riesgo moderado',
  'risk.High Risk': 'Riesgo alto',
  'risk.Critical Risk': 'Riesgo crítico',

  'urgency.Routine': 'Seguimiento de rutina',
  'urgency.Monitor': 'Vigilancia estrecha',
  'urgency.Refer': 'Derivar a nefrología',
  'urgency.Urgent': 'Derivación urgente',

  'action.Low Risk':
    'No se detectaron indicadores importantes de enfermedad renal. Se recomienda seguimiento de rutina. Reevaluar en 12 meses.',
  'action.Moderate Risk':
    'Algunos marcadores clínicos presentes. Perfil límite. Repetir las pruebas de laboratorio en 3 meses. Vigilar de cerca la presión arterial y el control de la diabetes.',
  'action.High Risk':
    'Perfil clínico muy sugestivo de enfermedad renal. Se recomienda derivación a nefrología. Se aconseja un estudio completo de la función renal.',
  'action.Critical Risk':
    'Perfil clínico altamente compatible con enfermedad renal. Se requiere derivación urgente a nefrología. Es necesaria una evaluación adicional inmediata.',

  'drivers.title': 'Qué determinó este resultado',
  'drivers.subtitle': 'Contribuciones de las variables',
  'drivers.loading': 'Analizando contribuciones…',
  'drivers.unavailable': 'Las explicaciones no están disponibles en este servidor.',
  'drivers.increases': 'Aumenta el riesgo',
  'drivers.reduces': 'Reduce el riesgo',
  'drivers.topDrivers': 'Factores principales',
  'drivers.note':
    'Muestra qué mediciones elevaron o redujeron esta predicción. Refleja el razonamiento del modelo, no causalidad clínica.',
  'drivers.bothAgree': 'Ambos métodos coinciden',
  'drivers.agreeHint': 'Que dos métodos independientes señalen los mismos factores es buena señal.',
  'drivers.limeNote':
    'LIME ajusta un modelo local simple alrededor de este paciente e indica la regla que activó cada medición. Es una aproximación local, por lo que puede ordenar los factores de forma distinta a SHAP.',
  'drivers.uploadPdf': 'Subir PDF de laboratorio',
  'pdf.extracting': 'Leyendo el informe de laboratorio…',
  'pdf.verify': 'Revise cada valor con el informe original antes de ejecutar la predicción.',
  'pdf.extracted': '{n} valor(es) extraído(s).',
  'pdf.missing': 'No encontrado: {fields}. Introdúzcalos manualmente.',

  'field.patientName': 'Nombre del paciente',
  'field.age': 'Edad',
  'field.gender': 'Sexo',
  'field.male': 'Hombre',
  'field.female': 'Mujer',

  'stats.today': 'Evaluaciones de hoy',
  'stats.todaySub': 'desde medianoche',
  'stats.referral': 'Requiere derivación',
  'stats.referralSub': 'riesgo alto o crítico',
  'stats.patients': 'Pacientes seguidos',
  'stats.patientsSub': 'con historial guardado',
  'stats.sensitivity': 'Tasa de detección',
  'stats.sensitivitySub': 'detecta ~3 de cada 4 casos',

  'status.online': 'API en línea',
  'status.offline': 'API fuera de línea',
  'status.checking': 'Comprobando',

  'common.loading': 'Cargando…',
  'common.viewAll': 'Ver todo',
  'common.none': 'Aún no hay registros.',
};

const DICTS: Record<Lang, Dict> = { en, fr, es };

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => en[k] ?? k,
});

const STORAGE_KEY = 'kg_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = (typeof window !== 'undefined'
      ? window.localStorage.getItem(STORAGE_KEY)
      : null) as Lang | null;
    if (saved && DICTS[saved]) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const t = (key: string) => DICTS[lang][key] ?? en[key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useT = () => useContext(I18nContext);
