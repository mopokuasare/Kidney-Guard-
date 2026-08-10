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
  'nav.predict': 'Predict Risk',
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

  'field.patientName': 'Patient Name',
  'field.age': 'Age',
  'field.gender': 'Gender',
  'field.male': 'Male',
  'field.female': 'Female',

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
  'nav.predict': 'Évaluer le risque',
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

  'field.patientName': 'Nom du patient',
  'field.age': 'Âge',
  'field.gender': 'Sexe',
  'field.male': 'Homme',
  'field.female': 'Femme',

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
  'nav.predict': 'Evaluar riesgo',
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

  'field.patientName': 'Nombre del paciente',
  'field.age': 'Edad',
  'field.gender': 'Sexo',
  'field.male': 'Hombre',
  'field.female': 'Mujer',

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
