import { createContext, useContext, useState, useEffect } from 'react'

var translations = {
  // ===== NAVIGATION =====
  'nav.home': { fr: 'Accueil', en: 'Home', es: 'Inicio', it: 'Home' },
  'nav.booking': { fr: 'Réservation', en: 'Booking', es: 'Reserva', it: 'Prenotazione' },
  'nav.clients': { fr: 'Clients', en: 'Clients', es: 'Clientes', it: 'Clienti' },
  'nav.finance': { fr: 'Finance', en: 'Finance', es: 'Finanzas', it: 'Finanza' },
  'nav.messages': { fr: 'Messages', en: 'Messages', es: 'Mensajes', it: 'Messaggi' },
  'nav.sport': { fr: 'Sport', en: 'Sport', es: 'Deporte', it: 'Sport' },
  'nav.timer': { fr: 'Timer', en: 'Timer', es: 'Temporizador', it: 'Timer' },
  'nav.admin': { fr: 'Admin', en: 'Admin', es: 'Admin', it: 'Admin' },
  'nav.logout': { fr: 'Déconnexion', en: 'Logout', es: 'Cerrar sesión', it: 'Esci' },
  'nav.backHome': { fr: '← Accueil', en: '← Home', es: '← Inicio', it: '← Home' },

  // ===== COMMON =====
  'common.save': { fr: 'Sauvegarder', en: 'Save', es: 'Guardar', it: 'Salvare' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel', es: 'Cancelar', it: 'Annulla' },
  'common.delete': { fr: 'Supprimer', en: 'Delete', es: 'Eliminar', it: 'Eliminare' },
  'common.edit': { fr: 'Modifier', en: 'Edit', es: 'Editar', it: 'Modificare' },
  'common.close': { fr: 'Fermer', en: 'Close', es: 'Cerrar', it: 'Chiudi' },
  'common.add': { fr: 'Ajouter', en: 'Add', es: 'Añadir', it: 'Aggiungere' },
  'common.search': { fr: 'Rechercher', en: 'Search', es: 'Buscar', it: 'Cerca' },
  'common.loading': { fr: 'Chargement...', en: 'Loading...', es: 'Cargando...', it: 'Caricamento...' },
  'common.yes': { fr: 'Oui', en: 'Yes', es: 'Sí', it: 'Sì' },
  'common.no': { fr: 'Non', en: 'No', es: 'No', it: 'No' },
  'common.confirm': { fr: 'Confirmer', en: 'Confirm', es: 'Confirmar', it: 'Confermare' },
  'common.back': { fr: 'Retour', en: 'Back', es: 'Volver', it: 'Indietro' },
  'common.next': { fr: 'Suivant', en: 'Next', es: 'Siguiente', it: 'Avanti' },
  'common.all': { fr: 'Tous', en: 'All', es: 'Todos', it: 'Tutti' },
  'common.none': { fr: 'Aucun', en: 'None', es: 'Ninguno', it: 'Nessuno' },
  'common.credits': { fr: 'crédits', en: 'credits', es: 'créditos', it: 'crediti' },
  'common.sessions': { fr: 'séances', en: 'sessions', es: 'sesiones', it: 'sessioni' },
  'common.min': { fr: 'min', en: 'min', es: 'min', it: 'min' },
  'common.month': { fr: 'mois', en: 'month', es: 'mes', it: 'mese' },

  // ===== LOGIN =====
  'login.title': { fr: 'Connexion', en: 'Login', es: 'Iniciar sesión', it: 'Accesso' },
  'login.email': { fr: 'Adresse email', en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email' },
  'login.password': { fr: 'Mot de passe', en: 'Password', es: 'Contraseña', it: 'Password' },
  'login.submit': { fr: 'Se connecter', en: 'Sign in', es: 'Iniciar sesión', it: 'Accedi' },
  'login.forgot': { fr: 'Mot de passe oublié ?', en: 'Forgot password?', es: '¿Olvidaste tu contraseña?', it: 'Password dimenticata?' },
  'login.mySpace': { fr: 'Mon espace client', en: 'My client space', es: 'Mi espacio cliente', it: 'Il mio spazio cliente' },

  // ===== DASHBOARD (CLIENT) =====
  'dash.welcome': { fr: 'Bienvenue', en: 'Welcome', es: 'Bienvenido/a', it: 'Benvenuto/a' },
  'dash.nextSession': { fr: 'Prochaine séance', en: 'Next session', es: 'Próxima sesión', it: 'Prossima sessione' },
  'dash.noSession': { fr: 'Aucune séance prévue', en: 'No session planned', es: 'Sin sesiones programadas', it: 'Nessuna sessione prevista' },
  'dash.book': { fr: 'Réserver', en: 'Book', es: 'Reservar', it: 'Prenotare' },
  'dash.myBookings': { fr: 'Mes séances', en: 'My sessions', es: 'Mis sesiones', it: 'Le mie sessioni' },
  'dash.shop': { fr: 'Acheter & Souscrire', en: 'Buy & Subscribe', es: 'Comprar y Suscribirse', it: 'Acquista e Abbonati' },
  'dash.program': { fr: 'Mon programme', en: 'My program', es: 'Mi programa', it: 'Il mio programma' },
  'dash.photos': { fr: 'Mon évolution', en: 'My progress', es: 'Mi evolución', it: 'La mia evoluzione' },
  'dash.drive': { fr: 'Mes documents', en: 'My documents', es: 'Mis documentos', it: 'I miei documenti' },
  'dash.settings': { fr: 'Mon profil', en: 'My profile', es: 'Mi perfil', it: 'Il mio profilo' },
  'dash.referral': { fr: 'Parrainage', en: 'Referral', es: 'Referencia', it: 'Referenza' },

  // ===== ADMIN =====
  'admin.dashboard': { fr: 'Tableau de bord', en: 'Dashboard', es: 'Panel de control', it: 'Pannello di controllo' },
  'admin.settings': { fr: 'Paramètres', en: 'Settings', es: 'Configuración', it: 'Impostazioni' },
  'admin.createClient': { fr: 'Créer un client', en: 'Create client', es: 'Crear cliente', it: 'Crea cliente' },
  'admin.addCredits': { fr: 'Ajouter des crédits', en: 'Add credits', es: 'Añadir créditos', it: 'Aggiungi crediti' },
  'admin.upcomingSessions': { fr: 'Séances à venir', en: 'Upcoming sessions', es: 'Próximas sesiones', it: 'Sessioni in arrivo' },
  'admin.todaySessions': { fr: 'Séances du jour', en: "Today's sessions", es: 'Sesiones de hoy', it: 'Sessioni di oggi' },
  'admin.revenue': { fr: 'Revenus', en: 'Revenue', es: 'Ingresos', it: 'Entrate' },
  'admin.newClients': { fr: 'Nouveaux clients', en: 'New clients', es: 'Nuevos clientes', it: 'Nuovi clienti' },

  // ===== SETTINGS TABS =====
  'settings.sessions': { fr: '🏋️ Séances', en: '🏋️ Sessions', es: '🏋️ Sesiones', it: '🏋️ Sessioni' },
  'settings.pricing': { fr: '💰 Tarifs', en: '💰 Pricing', es: '💰 Tarifas', it: '💰 Tariffe' },
  'settings.profile': { fr: '🌐 Profil', en: '🌐 Profile', es: '🌐 Perfil', it: '🌐 Profilo' },
  'settings.integrations': { fr: '🔗 Intégrations', en: '🔗 Integrations', es: '🔗 Integraciones', it: '🔗 Integrazioni' },
  'settings.billing': { fr: '🧾 Facturation', en: '🧾 Billing', es: '🧾 Facturación', it: '🧾 Fatturazione' },
  'settings.saveAll': { fr: 'Sauvegarder tous les paramètres', en: 'Save all settings', es: 'Guardar toda la configuración', it: 'Salva tutte le impostazioni' },
  'settings.saving': { fr: 'Sauvegarde...', en: 'Saving...', es: 'Guardando...', it: 'Salvataggio...' },

  // ===== SETTINGS - SESSIONS =====
  'settings.sessionDuration': { fr: 'Durée par défaut', en: 'Default duration', es: 'Duración predeterminada', it: 'Durata predefinita' },
  'settings.sessionPrice': { fr: 'Prix par défaut', en: 'Default price', es: 'Precio predeterminado', it: 'Prezzo predefinito' },
  'settings.buffers': { fr: '🚗 Tampons entre séances', en: '🚗 Buffers between sessions', es: '🚗 Tiempo entre sesiones', it: '🚗 Buffer tra sessioni' },
  'settings.reminders': { fr: '🔔 Rappels automatiques', en: '🔔 Auto reminders', es: '🔔 Recordatorios automáticos', it: '🔔 Promemoria automatici' },
  'settings.openingHours': { fr: '🕐 Jours et heures d\'ouverture', en: '🕐 Opening days & hours', es: '🕐 Días y horarios', it: '🕐 Giorni e orari' },

  // ===== SETTINGS - PROFILE =====
  'settings.coachingMode': { fr: 'Mode de coaching', en: 'Coaching mode', es: 'Modo de coaching', it: 'Modalità di coaching' },
  'settings.online': { fr: '🖥️ En ligne', en: '🖥️ Online', es: '🖥️ En línea', it: '🖥️ Online' },
  'settings.inPerson': { fr: '🏢 En salle', en: '🏢 In-person', es: '🏢 Presencial', it: '🏢 In sede' },
  'settings.atHome': { fr: '🏠 À domicile', en: '🏠 At home', es: '🏠 A domicilio', it: '🏠 A domicilio' },
  'settings.hybrid': { fr: '🔄 Hybride', en: '🔄 Hybrid', es: '🔄 Híbrido', it: '🔄 Ibrido' },
  'settings.myGyms': { fr: '📍 Mes salles', en: '📍 My gyms', es: '📍 Mis gimnasios', it: '📍 Le mie palestre' },
  'settings.addGym': { fr: '+ Ajouter une salle', en: '+ Add a gym', es: '+ Añadir un gimnasio', it: '+ Aggiungi palestra' },
  'settings.enableBilling': { fr: '🧾 Activer la facturation pour cette salle', en: '🧾 Enable billing for this gym', es: '🧾 Activar facturación para este gimnasio', it: '🧾 Attiva fatturazione per questa palestra' },
  'settings.brandName': { fr: 'Nom de marque', en: 'Brand name', es: 'Nombre de marca', it: 'Nome del brand' },
  'settings.specialty': { fr: 'Spécialité', en: 'Specialty', es: 'Especialidad', it: 'Specialità' },
  'settings.brandColor': { fr: 'Couleur de marque', en: 'Brand color', es: 'Color de marca', it: 'Colore del brand' },
  'settings.subdomain': { fr: 'Sous-domaine', en: 'Subdomain', es: 'Subdominio', it: 'Sottodominio' },
  'settings.saveIdentity': { fr: 'Sauvegarder l\'identité', en: 'Save identity', es: 'Guardar identidad', it: 'Salva identità' },

  // ===== SETTINGS - STRIPE =====
  'settings.payments': { fr: '💳 Recevoir mes paiements', en: '💳 Receive my payments', es: '💳 Recibir mis pagos', it: '💳 Ricevi i miei pagamenti' },
  'settings.stripeConnect': { fr: 'Connecter mon compte bancaire', en: 'Connect my bank account', es: 'Conectar mi cuenta bancaria', it: 'Collega il mio conto bancario' },
  'settings.stripeConnected': { fr: 'Compte connecté', en: 'Account connected', es: 'Cuenta conectada', it: 'Conto collegato' },
  'settings.stripeSecure': { fr: 'Sécurisé par Stripe · Aucun frais d\'inscription', en: 'Secured by Stripe · No registration fees', es: 'Asegurado por Stripe · Sin costes de registro', it: 'Protetto da Stripe · Nessun costo di registrazione' },

  // ===== PRICING =====
  'pricing.myOffers': { fr: '💰 Mes offres', en: '💰 My offers', es: '💰 Mis ofertas', it: '💰 Le mie offerte' },
  'pricing.newOffer': { fr: '➕ Nouvelle offre', en: '➕ New offer', es: '➕ Nueva oferta', it: '➕ Nuova offerta' },
  'pricing.session': { fr: '🏋️ Séance', en: '🏋️ Session', es: '🏋️ Sesión', it: '🏋️ Sessione' },
  'pricing.pack': { fr: '📦 Pack', en: '📦 Pack', es: '📦 Pack', it: '📦 Pack' },
  'pricing.subscription': { fr: '🔄 Abonnement', en: '🔄 Subscription', es: '🔄 Suscripción', it: '🔄 Abbonamento' },
  'pricing.price': { fr: 'Prix (€)', en: 'Price (€)', es: 'Precio (€)', it: 'Prezzo (€)' },
  'pricing.sessions': { fr: 'Nombre de séances', en: 'Number of sessions', es: 'Número de sesiones', it: 'Numero di sessioni' },
  'pricing.perWeek': { fr: 'Séances par semaine', en: 'Sessions per week', es: 'Sesiones por semana', it: 'Sessioni a settimana' },
  'pricing.crossedPrice': { fr: 'Prix barré (optionnel)', en: 'Crossed price (optional)', es: 'Precio tachado (opcional)', it: 'Prezzo barrato (opzionale)' },
  'pricing.description': { fr: 'Description (optionnel)', en: 'Description (optional)', es: 'Descripción (opcional)', it: 'Descrizione (opzionale)' },
  'pricing.badge': { fr: 'Badge (optionnel)', en: 'Badge (optional)', es: 'Distintivo (opcional)', it: 'Badge (opzionale)' },
  'pricing.createOffer': { fr: '💰 Créer l\'offre', en: '💰 Create offer', es: '💰 Crear oferta', it: '💰 Crea offerta' },
  'pricing.popular': { fr: '⭐ Populaire', en: '⭐ Popular', es: '⭐ Popular', it: '⭐ Popolare' },
  'pricing.bestValue': { fr: '🔥 Meilleur rapport', en: '🔥 Best value', es: '🔥 Mejor relación', it: '🔥 Miglior rapporto' },
  'pricing.premium': { fr: '💎 Premium', en: '💎 Premium', es: '💎 Premium', it: '💎 Premium' },
  'pricing.promo': { fr: '🎁 Promo', en: '🎁 Promo', es: '🎁 Promo', it: '🎁 Promo' },

  // ===== FINANCE =====
  'finance.journal': { fr: '📝 Journal', en: '📝 Journal', es: '📝 Diario', it: '📝 Giornale' },
  'finance.monthly': { fr: '📊 Mois', en: '📊 Month', es: '📊 Mes', it: '📊 Mese' },
  'finance.invoices': { fr: '🧾 Factures', en: '🧾 Invoices', es: '🧾 Facturas', it: '🧾 Fatture' },
  'finance.addEntry': { fr: '+ Ajouter', en: '+ Add', es: '+ Añadir', it: '+ Aggiungi' },
  'finance.coaching': { fr: '🏋️ Coaching', en: '🏋️ Coaching', es: '🏋️ Coaching', it: '🏋️ Coaching' },
  'finance.abo': { fr: '📦 Abo', en: '📦 Sub', es: '📦 Sub', it: '📦 Abb' },
  'finance.bookedSessions': { fr: '📅 Séances réservées', en: '📅 Booked sessions', es: '📅 Sesiones reservadas', it: '📅 Sessioni prenotate' },
  'finance.checkCompleted': { fr: 'Coche les séances effectuées.', en: 'Check completed sessions.', es: 'Marca las sesiones completadas.', it: 'Segna le sessioni completate.' },
  'finance.dayJournal': { fr: 'Journal du jour', en: "Today's journal", es: 'Diario del día', it: 'Diario del giorno' },
  'finance.importGcal': { fr: '📅 Importer depuis Google Calendar', en: '📅 Import from Google Calendar', es: '📅 Importar desde Google Calendar', it: '📅 Importa da Google Calendar' },

  // ===== CLIENTS =====
  'clients.all': { fr: '👥 Tous', en: '👥 All', es: '👥 Todos', it: '👥 Tutti' },
  'clients.inPerson': { fr: '🏢 Présentiel', en: '🏢 In-person', es: '🏢 Presencial', it: '🏢 In presenza' },
  'clients.atHome': { fr: '🏠 Domicile', en: '🏠 At home', es: '🏠 A domicilio', it: '🏠 A domicilio' },
  'clients.online': { fr: '📱 En ligne', en: '📱 Online', es: '📱 En línea', it: '📱 Online' },
  'clients.searchPlaceholder': { fr: '🔍 Rechercher par nom, email, téléphone...', en: '🔍 Search by name, email, phone...', es: '🔍 Buscar por nombre, email, teléfono...', it: '🔍 Cerca per nome, email, telefono...' },
  'clients.noResults': { fr: 'Aucun résultat', en: 'No results', es: 'Sin resultados', it: 'Nessun risultato' },

  // ===== SPORT / PROGRAMS =====
  'sport.programs': { fr: 'Programmes', en: 'Programs', es: 'Programas', it: 'Programmi' },
  'sport.exercises': { fr: 'Exercices', en: 'Exercises', es: 'Ejercicios', it: 'Esercizi' },
  'sport.videos': { fr: 'Vidéos', en: 'Videos', es: 'Vídeos', it: 'Video' },
  'sport.addExercise': { fr: '+ Exercice', en: '+ Exercise', es: '+ Ejercicio', it: '+ Esercizio' },
  'sport.addBlock': { fr: '+ Bloc', en: '+ Block', es: '+ Bloque', it: '+ Blocco' },
  'sport.save': { fr: '💾 Enregistrer', en: '💾 Save', es: '💾 Guardar', it: '💾 Salva' },
  'sport.assign': { fr: 'Assigner', en: 'Assign', es: 'Asignar', it: 'Assegna' },
  'sport.technique': { fr: 'Technique d\'exécution', en: 'Execution technique', es: 'Técnica de ejecución', it: 'Tecnica di esecuzione' },
  'sport.coachTips': { fr: '💡 Conseils du coach', en: '💡 Coach tips', es: '💡 Consejos del coach', it: '💡 Consigli del coach' },
  'sport.alternatives': { fr: '🔄 Alternatives', en: '🔄 Alternatives', es: '🔄 Alternativas', it: '🔄 Alternative' },
  'sport.coachNotes': { fr: '💬 Consignes coach', en: '💬 Coach instructions', es: '💬 Instrucciones del coach', it: '💬 Istruzioni del coach' },
  'sport.recommended': { fr: 'Préconisé par le coach', en: 'Recommended by coach', es: 'Recomendado por el coach', it: 'Raccomandato dal coach' },
  'sport.replace': { fr: '🔄 Remplacer', en: '🔄 Replace', es: '🔄 Reemplazar', it: '🔄 Sostituisci' },

  // ===== WORKOUT PLAYER =====
  'workout.series': { fr: 'SÉRIE', en: 'SET', es: 'SERIE', it: 'SERIE' },
  'workout.previous': { fr: 'PRÉCÉDENT', en: 'PREVIOUS', es: 'ANTERIOR', it: 'PRECEDENTE' },
  'workout.weight': { fr: 'CHARGE', en: 'WEIGHT', es: 'CARGA', it: 'CARICO' },
  'workout.reps': { fr: 'RÉPS', en: 'REPS', es: 'REPS', it: 'REPS' },
  'workout.rest': { fr: 'repos', en: 'rest', es: 'descanso', it: 'riposo' },
  'workout.done': { fr: 'Terminé', en: 'Done', es: 'Terminado', it: 'Completato' },
  'workout.finish': { fr: '🏆 Terminer la séance', en: '🏆 Finish session', es: '🏆 Terminar sesión', it: '🏆 Termina sessione' },
  'workout.startSession': { fr: 'Commencer la séance', en: 'Start session', es: 'Empezar sesión', it: 'Inizia sessione' },

  // ===== TIMER =====
  'timer.countdown': { fr: '⏳ Compte à rebours', en: '⏳ Countdown', es: '⏳ Cuenta atrás', it: '⏳ Conto alla rovescia' },
  'timer.stopwatch': { fr: '⏱️ Chronomètre', en: '⏱️ Stopwatch', es: '⏱️ Cronómetro', it: '⏱️ Cronometro' },
  'timer.start': { fr: 'Démarrer', en: 'Start', es: 'Iniciar', it: 'Avvia' },
  'timer.pause': { fr: 'Pause', en: 'Pause', es: 'Pausa', it: 'Pausa' },
  'timer.reset': { fr: 'Réinitialiser', en: 'Reset', es: 'Reiniciar', it: 'Reimposta' },
  'timer.custom': { fr: 'Personnalisé', en: 'Custom', es: 'Personalizado', it: 'Personalizzato' },

  // ===== MESSAGING =====
  'msg.sendMessage': { fr: 'Écrire un message...', en: 'Write a message...', es: 'Escribe un mensaje...', it: 'Scrivi un messaggio...' },
  'msg.send': { fr: 'Envoyer', en: 'Send', es: 'Enviar', it: 'Invia' },
  'msg.noMessages': { fr: 'Aucun message', en: 'No messages', es: 'Sin mensajes', it: 'Nessun messaggio' },

  // ===== BOOKING =====
  'booking.selectSlot': { fr: 'Sélectionnez un créneau', en: 'Select a slot', es: 'Selecciona un horario', it: 'Seleziona uno slot' },
  'booking.confirm': { fr: 'Confirmer la réservation', en: 'Confirm booking', es: 'Confirmar reserva', it: 'Conferma prenotazione' },
  'booking.cancelBooking': { fr: 'Annuler la réservation', en: 'Cancel booking', es: 'Cancelar reserva', it: 'Cancella prenotazione' },
  'booking.noSlots': { fr: 'Aucun créneau disponible', en: 'No slots available', es: 'Sin horarios disponibles', it: 'Nessuno slot disponibile' },
  'booking.location': { fr: '📍 Lieu de la séance', en: '📍 Session location', es: '📍 Ubicación de la sesión', it: '📍 Luogo della sessione' },
  'booking.suggestAddress': { fr: '📩 Proposer une autre adresse', en: '📩 Suggest another address', es: '📩 Sugerir otra dirección', it: '📩 Suggerisci un altro indirizzo' },

  // ===== COACH LANDING =====
  'landing.bookSession': { fr: 'Réserver ma séance →', en: 'Book my session →', es: 'Reservar mi sesión →', it: 'Prenota la mia sessione →' },
  'landing.contactMe': { fr: 'Me contacter', en: 'Contact me', es: 'Contactarme', it: 'Contattami' },
  'landing.services': { fr: 'Services', en: 'Services', es: 'Servicios', it: 'Servizi' },
  'landing.locations': { fr: 'Lieux', en: 'Locations', es: 'Ubicaciones', it: 'Luoghi' },
  'landing.pricing': { fr: 'Tarifs', en: 'Pricing', es: 'Tarifas', it: 'Tariffe' },
  'landing.readyToStart': { fr: 'Prêt à commencer ?', en: 'Ready to start?', es: '¿Listo para empezar?', it: 'Pronto a iniziare?' },
  'landing.chooseFormula': { fr: 'Choisissez votre formule', en: 'Choose your plan', es: 'Elige tu plan', it: 'Scegli il tuo piano' },
  'landing.transformation': { fr: 'Votre transformation commence ici', en: 'Your transformation starts here', es: 'Tu transformación empieza aquí', it: 'La tua trasformazione inizia qui' },

  // ===== DAYS =====
  'days.mon': { fr: 'Lundi', en: 'Monday', es: 'Lunes', it: 'Lunedì' },
  'days.tue': { fr: 'Mardi', en: 'Tuesday', es: 'Martes', it: 'Martedì' },
  'days.wed': { fr: 'Mercredi', en: 'Wednesday', es: 'Miércoles', it: 'Mercoledì' },
  'days.thu': { fr: 'Jeudi', en: 'Thursday', es: 'Jueves', it: 'Giovedì' },
  'days.fri': { fr: 'Vendredi', en: 'Friday', es: 'Viernes', it: 'Venerdì' },
  'days.sat': { fr: 'Samedi', en: 'Saturday', es: 'Sábado', it: 'Sabato' },
  'days.sun': { fr: 'Dimanche', en: 'Sunday', es: 'Domingo', it: 'Domenica' },

  // ===== LANGUAGE =====
  'lang.title': { fr: '🌐 Langue', en: '🌐 Language', es: '🌐 Idioma', it: '🌐 Lingua' },
  'lang.fr': { fr: 'Français', en: 'French', es: 'Francés', it: 'Francese' },
  'lang.en': { fr: 'Anglais', en: 'English', es: 'Inglés', it: 'Inglese' },
  'lang.es': { fr: 'Espagnol', en: 'Spanish', es: 'Español', it: 'Spagnolo' },
  'lang.it': { fr: 'Italien', en: 'Italian', es: 'Italiano', it: 'Italiano' },
}

var LangContext = createContext({ lang: 'fr', t: function(k) { return k } })

export function LangProvider({ children }) {
  var [lang, setLang] = useState(function() {
    try { return localStorage.getItem('app_lang') || 'fr' } catch(e) { return 'fr' }
  })

  useEffect(function() {
    try { localStorage.setItem('app_lang', lang) } catch(e) {}
  }, [lang])

  function t(key) {
    var entry = translations[key]
    if (!entry) return key
    return entry[lang] || entry.fr || key
  }

  return <LangContext.Provider value={{ lang: lang, setLang: setLang, t: t }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}

export default translations
