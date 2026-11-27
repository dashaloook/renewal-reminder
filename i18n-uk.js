// Ukrainian text for i18n.js: English → Ukrainian.
// Tone: friendly "ти", a little humour and everyday Ukrainian phrases; calm and plain wherever
// money, errors or deleting are involved. Brand names (Netflix, Spotify…) stay as they are.
(function () {
  const { UK, PATTERNS, pl, plural, t } = window.RRI18n;

  // Months: nominative → "у …" form (у листопаді), for "Nothing due in листопад" and similar.
  const IN = { січень: 'січні', лютий: 'лютому', березень: 'березні', квітень: 'квітні', травень: 'травні', червень: 'червні', липень: 'липні', серпень: 'серпні', вересень: 'вересні', жовтень: 'жовтні', листопад: 'листопаді', грудень: 'грудні' };
  const EN_M = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const UK_M = Object.keys(IN);
  const monthIn = (m) => { const w = String(m).trim().split(' '); let k = w[0].toLowerCase(); const i = EN_M.indexOf(k); if (i >= 0) k = UK_M[i]; return [IN[k] || k, ...w.slice(1)].join(' '); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  window.RRI18n.monthIn = monthIn;

  // Brand and product names: kept as they are (listed so they aren't reported as missing).
  ['Netflix', 'Spotify', 'Spotify Family', 'YouTube Premium', 'ChatGPT', 'ChatGPT Plus', 'Claude', 'iCloud+', 'Google One', 'Adobe Creative Cloud',
    'Telegram Premium', 'Meta Verified', 'X Premium', 'Snapchat+', 'Megogo', 'Kyivstar TV', 'Sweet.tv', 'Prime Video', 'Renewal Reminder',
    'USD', 'EUR', 'UAH', 'NBU', 'AI', 'Pro', 'Max 5×', 'Max 20×', 'Premium', 'Basic', 'Standard', 'Light', 'Maximum', 'Start', 'Plus', 'Family', 'Individual', 'Duo', 'Student', 'Instagram / Facebook', 'All Apps', 'alex@example.com', 'English', 'ENG', 'УКР', 'Українська']
    .forEach((b) => { UK[b] = b; });

  Object.assign(UK, {
    // ---- navigation & common ----
    'Dashboard': 'Головна', 'My reminders': 'Мої нагадування', 'My reminders ›': 'Мої нагадування ›', 'Profile': 'Профіль',
    'Main navigation': 'Головне меню', 'Expand sidebar': 'Розгорнути меню', 'Collapse sidebar': 'Згорнути меню',
    'Demo': 'Демо', 'Demo mode: all data is for demonstration': 'Демо-режим: усі дані — для прикладу', 'Demo data': 'Демо-дані',
    'Back': 'Назад', 'Cancel': 'Скасувати', 'Continue': 'Далі', 'Skip': 'Пропустити', 'Open': 'Відкрити', 'Edit': 'Змінити', 'Delete': 'Видалити',
    'Add': 'Додати', 'Show': 'Показати', 'View': 'Вигляд', 'Sort': 'Сортування', 'Status': 'Статус', 'All': 'Усі', 'all': 'усього', 'Date': 'Дата',
    'Undo': 'Повернути', 'Dismiss': 'Закрити', 'Dismiss notification': 'Закрити сповіщення', 'Try again': 'Спробувати ще раз', 'Discard': 'Не зберігати',
    'Log out': 'Вийти', 'Delete account': 'Видалити акаунт', 'Today': 'Сьогодні', 'Tomorrow': 'Завтра', 'today': 'сьогодні', 'tomorrow': 'завтра',
    'Later': 'Пізніше', 'New': 'Нове', 'Preview': 'Попередній перегляд', 'Suggestions': 'Підказки', 'Currency': 'Валюта', 'Main currency': 'Основна валюта',
    'Language': 'Мова', 'US dollar': 'Долар США', 'Euro': 'Євро', 'Hryvnia': 'Гривня',
    'Official rate of the National Bank of Ukraine': 'Офіційний курс Національного банку України', 'Offline: approximate rate': 'Офлайн: приблизний курс',
    'approx.': 'приблизно', 'market': 'ринковий',
    'Loading your reminders…': 'Завантажуємо нагадування…', 'Your reminders': 'Твої нагадування', 'Your reminder': 'Твоє нагадування',

    // ---- categories, cycles, statuses, reasons (data.js) ----
    'Subscriptions': 'Підписки', 'Subscription': 'Підписка', 'Payments': 'Платежі', 'Payment': 'Платіж', 'Documents': 'Документи', 'Document': 'Документ',
    'Insurance': 'Страховки', 'Household': 'Побут', 'All categories': 'Усі категорії',
    'Weekly': 'Щотижня', 'Monthly': 'Щомісяця', 'Yearly': 'Щороку', 'One-time': 'Разово', 'week': 'тиж.', 'month': 'міс.', 'year': 'рік',
    'a week': 'на тиждень', 'a month': 'на місяць', 'a year': 'на рік',
    'Active': 'Активні', 'active': 'активне', 'kept': 'залишено', 'cancelled': 'скасовано', 'unfinished': 'не вирішено', 'Unfinished': 'Не вирішено', 'Cancelled': 'Скасовано', 'Kept': 'Залишено',
    'Unfinished decision': 'Рішення відкладено', 'unfinished decision': 'рішення відкладено', 'Unfinished decisions': 'Відкладені рішення', 'note': 'нотатка',
    'No access to account': 'Немає доступу до акаунта', 'Need to compare prices': 'Треба порівняти ціни', 'Need to discuss with someone': 'Треба з кимось порадитися', 'Other': 'Інше',
    'Video & music': 'Відео й музика', 'Social': 'Соцмережі', 'Cloud & tools': 'Хмари й інструменти',
    'Mo': 'Пн', 'Tu': 'Вт', 'We': 'Ср', 'Th': 'Чт', 'Fr': 'Пт', 'Sa': 'Сб', 'Su': 'Нд',
    'Mon': 'Пн', 'Tue': 'Вт', 'Wed': 'Ср', 'Thu': 'Чт', 'Fri': 'Пт', 'Sat': 'Сб', 'Sun': 'Нд',
    'Jan': 'січ', 'Feb': 'лют', 'Mar': 'бер', 'Apr': 'кві', 'May': 'тра', 'Jun': 'чер', 'Jul': 'лип', 'Aug': 'сер', 'Sep': 'вер', 'Oct': 'жов', 'Nov': 'лис', 'Dec': 'гру',

    // ---- demo data ----
    'Alex Koval': 'Олекса Коваль', 'Alex': 'Олексо', 'AK': 'ОК', 'Home internet': 'Домашній інтернет', 'Gym membership': 'Абонемент у спортзал', 'Tax return': 'Податкова декларація',
    'Driver’s licence': 'Посвідчення водія', 'Car liability insurance': 'Автоцивілка', 'Health insurance': 'Медична страховка',
    'Vehicle inspection': 'Техогляд авто', 'Water filter replacement': 'Заміна фільтра для води',
    'Shared account — ask Sam for the password.': 'Спільний акаунт — спитати пароль у Сашка.',
    'Check Affinity or the Photography plan.': 'Глянути Affinity або тариф Photography.',
    'Yearly filing deadline. Collect receipts and statements first.': 'Щорічний дедлайн декларації. Спершу зібрати чеки й виписки.',
    'New reminder': 'Нове нагадування', 'new': 'нове', 'nothing due': 'нічого не списується',
    'Use arrow keys to move between days, Page Up and Page Down to change month.': 'Стрілками — між днями, Page Up і Page Down — між місяцями.',
    'Created': 'Створено', 'Edited': 'Змінено', 'Added during setup': 'Додано під час налаштування', 'Decided: Keep it': 'Рішення: залишаю', 'Decided: I cancelled it': 'Рішення: скасовано',

    // ---- login ----
    'Log in': 'Увійти', 'Logging in…': 'Входимо…', 'Create account': 'Створити акаунт', 'Creating account…': 'Створюємо акаунт…', 'Create your password': 'Придумай пароль',
    'Welcome back. Your reminders are waiting.': 'З поверненням! Нагадування вже чекають.', 'Your reminders are saved to your account, on any device.': 'Нагадування зберігаються в акаунті — на будь-якому пристрої.',
    'Reset password': 'Відновити пароль', 'Enter your account email. We’ll send you a link to choose a new password.': 'Введи email акаунта — надішлемо посилання, щоб задати новий пароль.',
    'Send reset link': 'Надіслати посилання', 'Enter your email.': 'Введи email.', 'This doesn’t look like an email yet. Try the format name@example.com.': 'Це ще не схоже на email. Спробуй у форматі name@example.com.',
    'Enter your name, so we know what to call you.': 'Як тебе звати? Щоб знати, як до тебе звертатися.', 'Your password needs everything on the list below.': 'Паролю потрібно все зі списку нижче.',
    'Choose a password that matches the list below.': 'Придумай пароль, що відповідає списку нижче.', 'Enter your password.': 'Введи пароль.',
    'At least 8 characters': 'Щонайменше 8 символів', 'At least 1 uppercase letter': 'Хоча б 1 велика літера', 'At least 1 lowercase letter': 'Хоча б 1 мала літера', 'At least 1 number': 'Хоча б 1 цифра',
    'Not you?': 'Не ти?', 'Check your inbox': 'Зазирни в пошту', 'Back to log in': 'Назад до входу', 'Use a different email': 'Інший email', 'Continue with Google': 'Продовжити з Google',
    'Try the demo without signing up': 'Спробувати демо без реєстрації', 'or create an account with email': 'або створи акаунт через email', 'or log in with email': 'або увійди через email',
    'Your name': 'Твоє імʼя', 'Name': 'Назва', 'Email': 'Email', 'Password': 'Пароль', 'Hide password': 'Сховати пароль', 'Show password': 'Показати пароль', 'Forgot password?': 'Забув(-ла) пароль?',
    'Your password needs': 'Паролю потрібно', ': not yet': ': ще ні', 'We’ll email you a link to confirm your address. You need it to get reminder emails.': 'Надішлемо лист, щоб підтвердити адресу. Без цього нагадування на пошту не прийдуть.',
    'Create one': 'Створити', 'Log in instead': 'Краще увійти', 'Already have an account?': 'Вже маєш акаунт?', 'No account yet?': 'Ще немає акаунта?', 'Remembered it?': 'Згадав(-ла)?',
    'Why Renewal Reminder': 'Навіщо Renewal Reminder', 'No unwanted charges this month': 'Цього місяця — жодних небажаних списань',
    '7 of 8 renewals were decided before the charge date. Every “keep” and “cancel” was a choice, not an accident.': '7 з 8 продовжень вирішено ще до списання. Кожне «залишити» і «скасувати» — свідомий вибір, а не випадковість.',
    'That password isn’t right. Nothing was deleted.': 'Пароль не підходить. Нічого не видалено.', 'Something went wrong.': 'Щось пішло не так.', 'Nothing was deleted.': 'Нічого не видалено.',

    // ---- onboarding ----
    'No more surprise charges.': 'Жодних несподіваних списань.', 'We remind you a week before you pay. You decide.': 'Нагадаємо за тиждень до оплати. А вирішуєш ти — ми лише смикнемо за рукав 😉',
    'of people found they were still paying for a subscription they forgot about.': 'людей помітили, що досі платять за підписку, про яку давно забули.', 'Source': 'Джерело',
    'Charged today · you forgot to cancel': 'Списано сьогодні · забули скасувати', 'instead': 'замість цього', 'Netflix renews in 7 days': 'Netflix продовжиться через 7 днів',
    'Keep it, cancel it, or decide later': 'Залишити, скасувати чи вирішити пізніше', 'Reminder': 'Нагадування',
    'Let’s find yours': 'Знайдімо твої', 'What do you pay for?': 'За що ти платиш?',
    'Tap to add — these become your first reminders. Pick your plan and next charge date.': 'Тицяй, щоб додати, — це будуть твої перші нагадування. Обери тариф і дату наступного списання.',
    'Next charge': 'Наступне списання', 'Prices are typical list prices — change them anytime. Anything else? Add it from “My reminders” later.': 'Ціни — типові, змінити можна будь-коли. Щось іще? Додаси пізніше в «Моїх нагадуваннях».',
    'You’re covered 🎉': 'Тепер ти під захистом 🎉', 'All set 👋': 'Усе готово 👋', 'Add your first reminder whenever you’re ready.': 'Додай перше нагадування, коли будеш готовий(-а).',
    'First reminder': 'Перше нагадування', 'We remind you 7 days before': 'Нагадаємо за 7 днів', 'Keep, cancel or decide later': 'Залишити, скасувати чи відкласти', 'No surprise charges': 'Жодних сюрпризів у виписці',
    'How it works': 'Як це працює', 'Nothing selected yet': 'Поки нічого не обрано', 'Continue without adding': 'Далі без додавання', 'Go to my dashboard': 'На головну',
    'selected ·': 'обрано ·', '/month ·': '/міс ·', '/year': '/рік', '/month': '/міс',

    // ---- dashboard ----
    'Good morning': 'Доброго ранку', 'Good afternoon': 'Добрий день', 'Good evening': 'Добрий вечір',
    'Let’s add the first thing you don’t want to renew by accident.': 'Додаймо першу річ, яку не хочеться продовжити випадково.', 'Add reminder': 'Додати нагадування',
    'nothing is waiting for you': 'нічого не чекає — можна видихнути',
    'Turn on notifications so you don’t miss a renewal': 'Увімкни сповіщення, щоб не проґавити списання', 'Browser notifications are off. We only notify you about reminders you set.': 'Сповіщення в браузері вимкнені. Пишемо тільки про нагадування, які ти сам(-а) створив(-ла).',
    'Notifications are off': 'Сповіщення вимкнені', 'Turn on': 'Увімкнути', 'View all': 'Усі', 'waiting': 'чекають',
    'You postponed these. They’ll keep coming back until you decide — no pressure, just no surprises.': 'Це ти відклав(-ла). Вони повертатимуться, доки не вирішиш, — без тиску, просто без сюрпризів.',
    'Nothing is waiting for you. We’ll bring the next one here when it’s due.': 'Нічого не чекає — можна видихнути. Наступне принесемо сюди, коли настане час.',
    'Key numbers': 'Головні цифри', 'This month': 'Цього місяця', 'Monthly equivalent of active items': 'Скільки виходить на місяць за активними пунктами',
    'Per year (projection)': 'За рік (прогноз)', 'Incl. one-time costs in the next 12 months': 'Разом із разовими витратами на найближчі 12 місяців', 'Next 30 days': 'Найближчі 30 днів',
    'Decided on time': 'Вирішено вчасно', 'Decisions made before the charge date': 'Рішення, ухвалені до дати списання', 'Fills in after your first decision': 'Зʼявиться після першого рішення',
    'Spend by category': 'Витрати за категоріями', 'Projected per year · tap a category to see it in the calendar': 'Прогноз на рік · натисни категорію, щоб побачити її в календарі',
    'Charges over the next 6 months': 'Списання на найближчі 6 місяців', 'Total per month · tap a month to open it': 'Сума за місяць · натисни місяць, щоб відкрити', 'Charges per month': 'Списання за місяцями',
    'We couldn’t load this chart': 'Графік не завантажився', 'Your reminders are safe. Check your connection and try again.': 'З нагадуваннями все гаразд. Перевір зʼєднання і спробуй ще раз.',
    'Upcoming': 'Найближчі', 'See all reminders': 'Усі нагадування', 'Not decided yet': 'Ще не вирішено', 'No follow-up set yet': 'Повторне нагадування ще не задано',
    'I cancelled it': 'Вже скасовано', 'Keep it': 'Залишаю', 'Decide later': 'Вирішу пізніше', 'Postponed:': 'Відкладено:',
    'No costs yet. Add an amount to a reminder to see where your money goes.': 'Витрат поки немає. Додай суму до нагадування — і побачиш, куди тікають гроші.',
    'No charges in the next 6 months.': 'У найближчі 6 місяців списань немає. Красота!', '· renews': '· списання', '· Monthly': '· щомісяця',
    'Your data is safe. Check your connection and try again.': 'Дані в безпеці. Перевір зʼєднання і спробуй ще раз.', 'We couldn’t load your reminders': 'Не вдалося завантажити нагадування',

    // ---- details ----
    'Close details': 'Закрити', 'What did you decide?': 'Що вирішуєш?', 'You cancelled this.': 'Ти це скасував(-ла).', 'It no longer counts in your totals.': 'Воно більше не рахується в підсумках.',
    'Amount': 'Сума', 'Per year': 'За рік', 'Remind me': 'Нагадати', 'Note': 'Нотатка', 'Email reminder': 'Нагадування на email', 'On the reminder day we email': 'У день нагадування напишемо на',
    '. Send yourself a test now to see it.': '. Надішли собі тестовий лист, щоб побачити, як це виглядає.', 'Send test email': 'Надіслати тестовий лист',
    'Emails go to your own address. Log in with Google or a real email account to get them.': 'Листи приходять на твою адресу. Щоб їх отримувати, увійди через Google або справжній email.',
    'Send the confirmation link again': 'Надіслати посилання ще раз', 'Browser notification': 'Сповіщення в браузері', ', even if the app is closed': ', навіть коли застосунок закритий', 'while the app is open': 'поки застосунок відкритий',
    'Send test notification': 'Надіслати тестове сповіщення', 'Notifications are off on this device, so we can’t remind you here.': 'На цьому пристрої сповіщення вимкнені, тож тут нагадати не вийде.',
    'Turn on notifications': 'Увімкнути сповіщення', 'History': 'Історія', 'Add a cancel link': 'Додати посилання на скасування', 'Cancel on': 'Скасувати на',
    'Renewal Reminder never cancels anything for you — you do it on the service, then tell us here.': 'Renewal Reminder нічого не скасовує за тебе — це робиш ти на сайті сервісу, а потім відмічаєш тут.',
    'Stopped paying? Use “I cancelled it” instead — it keeps the history.': 'Більше не платиш? Краще натисни «Вже скасовано» — так збережеться історія.', 'Delete reminder': 'Видалити нагадування',
    'Delete this reminder?': 'Видалити нагадування?', 'Keep reminder': 'Залишити нагадування',
    'Notifications are blocked for this site. To get reminders here, allow them in your browser’s site settings — the icon to the left of the address.': 'Сповіщення для сайту заблоковані. Щоб отримувати нагадування тут, дозволь їх у налаштуваннях сайту — значок ліворуч від адреси.',
    'Notifications are blocked': 'Сповіщення заблоковані', 'Notifications are blocked for this site.': 'Сповіщення для сайту заблоковані.',
    'Notifications are blocked for this site. Allow them in your browser’s site settings, or choose Email.': 'Сповіщення для сайту заблоковані. Дозволь їх у налаштуваннях сайту або обери Email.',
    ', allow them in your browser’s site settings — the icon to the left of the address.': ', дозволь їх у налаштуваннях сайту — значок ліворуч від адреси.',
    'To get this reminder on': 'Щоб отримати це нагадування', 'Allow notifications': 'Дозволити сповіщення',

    // ---- added popup ----
    'Added. We’ll remind you on': 'Додано. Нагадаємо', 'It’s already on your dashboard and in your list.': 'Воно вже на головній і в списку.', 'Add another': 'Додати ще', 'Go to my list': 'До списку',
    'Renews': 'Списання', 'Expires': 'Спливає', '· reminder': '· нагадування', 'by email': 'на email', 'in the browser': 'у браузері', 'in this browser': 'у цьому браузері',
    'Email reminder is set.': 'Нагадування на email готове.', 'We’ll email': 'Напишемо на', 'Email reminders need a real account.': 'Для нагадувань на email потрібен справжній акаунт.',
    'You’re all set.': 'Усе готово.', '— even if the app is closed': '— навіть коли застосунок закритий', ', even when the app is closed': ', навіть коли застосунок закритий',

    // ---- decide later ----
    'In 3 days': 'Через 3 дні', 'The day before the next charge': 'За день до наступного списання', 'The day before the charge': 'За день до списання', 'Next week': 'Наступного тижня',
    'Choose when we should remind you.': 'Обери, коли нагадати.', 'Cancel. Nothing changes.': 'Скасувати. Нічого не зміниться.', 'This charge is today': 'Списання сьогодні', 'This charge date has passed': 'Дата списання минула',
    'Pick when to remind you.': 'Обери, коли нагадати.', 'What’s stopping you right now?': 'Що заважає вирішити зараз?', '(optional)': '(необовʼязково)', 'Remind me again': 'Нагадати ще раз',
    'That’s today — pick a later time.': 'Це сьогодні — обери пізніший час.', 'Not available': 'Недоступно', '— after the charge': '— після списання', 'Or pick a date': 'Або обери дату',
    'Choose a date': 'Обрати дату', 'Save and remind me': 'Зберегти й нагадати',

    // ---- delete account ----
    'Enter your password to confirm it’s you.': 'Введи пароль, щоб підтвердити, що це ти.', 'Delete your account?': 'Видалити акаунт?', 'This permanently deletes': 'Це назавжди видалить',
    'and everything in it. You can’t undo this.': 'і все, що в ньому. Повернути не вийде.', 'Reminder emails and browser notifications stop': 'Листи й сповіщення більше не надходитимуть',
    'Your login is removed': 'Вхід до акаунта буде видалено', 'Your subscriptions themselves aren’t cancelled. Cancel them on each service’s website.': 'Самі підписки не скасуються. Скасуй їх на сайті кожного сервісу.',
    'Enter your password to confirm': 'Введи пароль для підтвердження', 'To make sure it’s you, Google will ask you to choose your account once more.': 'Щоб переконатися, що це ти, Google ще раз попросить обрати акаунт.',
    'Keep my account': 'Залишити акаунт', 'Your account is deleted': 'Акаунт видалено', 'Your reminders and settings are gone. Thanks for trying Renewal Reminder.': 'Нагадування й налаштування видалено. Дякуємо, що спробував(-ла) Renewal Reminder!',

    // ---- date picker ----
    'Select a date': 'Обери дату', 'Previous month': 'Попередній місяць', 'Next month': 'Наступний місяць', 'Arrow keys move · Enter picks · Esc closes': 'Стрілки — рух · Enter — вибір · Esc — закрити',
    'Go to today': 'До сьогодні', 'Calendar view': 'Календар', 'List view': 'Список',

    // ---- new reminder form ----
    'Add a reminder': 'Нове нагадування', 'Add a new reminder': 'Додати нове нагадування', 'Pick a service to prefill, or enter it yourself. Takes about 30 seconds.': 'Обери сервіс — поля заповняться самі. Або введи вручну. Це секунд 30, чесно.',
    'Quick start': 'Швидкий старт', 'Search service templates': 'Пошук сервісу', 'Search services, e.g. Netflix, Spotify, iCloud': 'Шукай сервіс, напр. Netflix, Spotify, iCloud',
    'Matching services': 'Знайдені сервіси', 'Popular subscriptions': 'Популярні підписки', 'No matching service': 'Такого сервісу не знайшли', 'Enter manually': 'Ввести вручну',
    'Category': 'Категорія', 'Amount (optional)': 'Сума (необовʼязково)', 'Use numbers only, like 9.99.': 'Лише цифри, наприклад 9.99.', 'Billing cycle': 'Як часто платиш',
    'Expiry date': 'Дата закінчення', 'Next charge date': 'Дата наступного списання', 'This date is in the past. You can still save — just check it’s right.': 'Ця дата вже минула. Зберегти можна — просто перевір, чи все правильно.',
    'Remind me (days before)': 'Нагадати (за скільки днів)', 'today or past': 'сьогодні або вже минуло', 'On the day': 'У день списання', 'on the day': 'у день списання',
    'It renews today': 'Списання сьогодні', 'This date has passed': 'Ця дата минула', 'Channel': 'Канал', 'Browser': 'Браузер',
    'Browser reminders need notifications on this device.': 'Для нагадувань у браузері потрібні сповіщення на цьому пристрої.', 'Link to cancel or manage (optional)': 'Посилання на скасування чи керування (необовʼязково)',
    'e.g. netflix.com/cancelplan': 'напр. netflix.com/cancelplan', 'Note (optional)': 'Нотатка (необовʼязково)', 'e.g. Family plan, shared with Sam': 'напр. сімейний тариф, ділимо з Сашком',
    'Some letters came through as “?”. The app you copied from lost them — copy the text again from the original, or type it here.': 'Частина літер перетворилася на «?». Застосунок, звідки ти копіював(-ла), їх загубив — скопіюй ще раз з оригіналу або набери тут.',
    'Save changes': 'Зберегти зміни', 'Save reminder': 'Зберегти нагадування', 'Saving…': 'Зберігаємо…', 'We’ll remind you on': 'Нагадаємо', 'Add a name and a date to save.': 'Додай назву й дату, щоб зберегти.',
    'Add a name and date to see your reminder here.': 'Додай назву й дату — і нагадування зʼявиться тут.', 'Preview · updates as you type': 'Попередній перегляд · оновлюється, поки друкуєш',
    'Discard this reminder?': 'Не зберігати нагадування?', 'You’ve started filling it in. If you leave now, these changes won’t be saved.': 'Ти вже почав(-ла) заповнювати. Якщо вийдеш зараз, зміни не збережуться.',
    'Add a name so you know what this is, e.g. “Disney+”.': 'Додай назву, щоб знати, що це, напр. «Netflix».', 'Add the next charge or expiry date — we remind you before it.': 'Додай дату списання чи закінчення — нагадаємо заздалегідь.',
    'This doesn’t look like a web address. Try netflix.com/cancelplan or paste the full link.': 'Це не схоже на адресу сайту. Спробуй netflix.com/cancelplan або встав повне посилання.',
    'Reminder by notification in this browser.': 'Нагадаємо сповіщенням у цьому браузері.', 'Turn on notifications to get the browser reminder.': 'Увімкни сповіщення, щоб отримати нагадування в браузері.',
    'Clear search': 'Очистити пошук', 'Clear note': 'Очистити нотатку', 'Clear link': 'Очистити посилання', 'Clear name': 'Очистити назву',

    // ---- list & calendar ----
    'Search reminders': 'Пошук нагадувань', 'Nothing found': 'Нічого не знайшли 🤷', 'Try another name, or reset filters.': 'Спробуй іншу назву або скинь фільтри.', 'Not added yet?': 'Ще не додано?',
    'No reminders match these filters.': 'Під ці фільтри нічого не підходить.', 'Reset filters': 'Скинути фільтри', 'Show only unfinished decisions': 'Показати лише відкладені рішення',
    'This week': 'Цього тижня', 'Next:': 'Далі:', 'Nothing is due on this day.': 'Цього дня нічого не списується.', 'Nothing due': 'Нічого не списується', 'need': 'чекають',
    'No reminders yet': 'Поки порожньо, як у гаманці перед зарплатою', 'Add a subscription, payment, document or insurance. We’ll remind you before it renews and help you decide.': 'Додай підписку, платіж, документ чи страховку. Нагадаємо до списання й допоможемо вирішити.',
    'Add your first reminder': 'Додати перше нагадування', 'Popular:': 'Популярне:', 'Popular services': 'Популярні сервіси',
    'Arrow keys move between days · Page Up / Page Down change month · Enter opens a reminder below': 'Стрілки — між днями · Page Up / Page Down — місяць · Enter відкриває нагадування нижче',
    'Name A–Z': 'Назва А–Я', 'Amount ↓': 'Сума ↓', 'Next date': 'Найближча дата', 'All results': 'Усі результати', 'Later this month': 'Пізніше цього місяця', 'Later on': 'Пізніше',

    'Note for future you, e.g. “Ask Sam for the password” (optional)': 'Нотатка для себе в майбутньому, напр. «Спитати пароль у Сашка» (необовʼязково)',
    'Postponed because:': 'Відкладено, бо:', 'renews': 'списання', 'Typical': 'Типова ціна для', 'price. Change it if yours differs.': '— зміни, якщо в тебе інша.',
    'Welcome,': 'Вітаємо,', 'Search by name or note': 'Пошук за назвою чи нотаткою',
    'Notifications are blocked for this site. To get reminders here, allow them in your browser’s site settings — the icon to the left of the address. You can still save — it will show on your dashboard.': 'Сповіщення для сайту заблоковані. Щоб отримувати нагадування тут, дозволь їх у налаштуваннях сайту — значок ліворуч від адреси. Зберегти все одно можна — нагадування буде на головній.',

    'marked as cancelled': 'скасовано', 'Exchange rate from': 'Курс від', 'Reminder set': 'Нагадування створено', 'Notifications are on': 'Сповіщення увімкнено',
    '— even when the app is closed': '— навіть коли застосунок закритий', 'Not now': 'Не зараз', '· Today': '· Сьогодні',
    'Browser notifications are off. You can still save without them — we’ll show it on your dashboard.': 'Сповіщення в браузері вимкнені. Зберегти можна й без них — покажемо на головній.',
    'We’ll notify you on each reminder day while the app is open. Log in with a real account to get them when it’s closed.': 'Нагадаємо в кожен день нагадування, поки застосунок відкритий. Щоб отримувати їх і коли він закритий, увійди в справжній акаунт.',

    // ---- toasts ----
    'Couldn’t save to your account': 'Не вдалося зберегти в акаунт', 'Check your connection. Changes stay on this device and sync when you’re back online.': 'Перевір зʼєднання. Зміни лишаться на пристрої й синхронізуються, щойно будеш онлайн.',
    'Totals updated. You can undo for 6 seconds.': 'Підсумки оновлено. Передумати можна протягом 6 секунд.', 'It stays in Unfinished decisions so it won’t get lost.': 'Воно лишиться у відкладених рішеннях — не загубиться.',
    'Your subscription itself was not changed.': 'Саму підписку не змінено.', 'Demo reset': 'Демо скинуто', 'All demo data is back to the start.': 'Демо-дані повернулися до початку.',
    'Reminder email sent': 'Лист-нагадування надіслано', 'Couldn’t send the reminder email': 'Не вдалося надіслати лист-нагадування',
    'Notifications are on for this browser': 'Сповіщення в цьому браузері увімкнено', 'We’ll notify this device on each reminder day, even when the app is closed.': 'Нагадаємо на цей пристрій у кожен день нагадування, навіть коли застосунок закритий.',
    'You’re all set': 'Усе готово', 'We’ll nudge you here before anything renews, so you can decide in time.': 'Смикнемо тебе тут до будь-якого списання, щоб устиг(-ла) вирішити.',
    'Test notification sent. Look at the corner of your screen.': 'Тестове сповіщення надіслано. Глянь у куточок екрана.', 'This browser didn’t show it. Check that notifications are allowed for this site.': 'Браузер його не показав. Перевір, чи дозволені сповіщення для сайту.',
    'Still need it?': 'Ще потрібно?', 'Decide before you’re charged.': 'Виріши до списання.', 'Decide before tomorrow’s charge.': 'Виріши до завтрашнього списання.', 'Take a moment to decide.': 'Хвилинка — і вирішено.',
    'You asked us to remind you today. It only takes a moment.': 'Ти просив(-ла) нагадати сьогодні. Це на хвилинку.', 'Check what you need to renew it.': 'Перевір, що потрібно для продовження.',
    'Start renewing it now, so it doesn’t run out.': 'Почни продовжувати вже зараз, щоб не спливло.', 'Expires today': 'Спливає сьогодні', 'No cost': 'Безкоштовно',
  });

  const tr = (s) => t(s);
  const money = '([^ ]+)';
  PATTERNS.push(
    // amounts and periods
    [/^(.+) \/ (week|month|year)$/, (m) => `${m[1]} / ${{ week: 'тиж.', month: 'міс.', year: 'рік' }[m[2]]}`],
    [/^(.+) in total$/, (m) => `Разом ${m[1]}`],
    [/^from (.+)$/, (m) => `від ${m[1]}`],
    [/^Still worth (.+?)( a week| a month| a year)?\?$/, (m) => `Ще варте ${m[1]}${m[2] ? ' ' + tr(m[2].trim()) : ''}?`],
    // counts
    [/^(\d+) days?$/, (m) => pl(m[1], 'day')],
    [/^(\d+) days before$/, (m) => `за ${pl(m[1], 'day')}`],
    [/^\((\d+) days before\)$/, (m) => `(за ${pl(m[1], 'day')})`],
    [/^In (\d+) days?$/, (m) => `Через ${pl(m[1], 'day')}`],
    [/^in (\d+) days?$/, (m) => `через ${pl(m[1], 'day')}`],
    [/^(\d+) days? ago$/, (m) => `${pl(m[1], 'day')} тому`],
    [/^(\d+) charges?$/, (m) => pl(m[1], 'charge')],
    [/^(\d+) of (\d+)$/, (m) => `${m[1]} з ${m[2]}`],
    [/^Step (\d+) of (\d+)$/, (m) => `Крок ${m[1]} з ${m[2]}`],
    [/^Add (\d+) reminders?$/, (m) => `Додати ${pl(m[1], 'reminder')}`],
    [/^(\d+) decisions? (?:is|are) waiting for you$/, (m) => `на тебе ${plural(m[1], 'чекає', 'чекають', 'чекають')} ${pl(m[1], 'decision')}`],
    [/^(\d+) needs? a decision$/, (m) => `${m[1]} ${plural(m[1], 'чекає', 'чекають', 'чекають')} рішення`],
    [/^(\d+) needs? a decision\. Show only these$/, (m) => `${m[1]} ${plural(m[1], 'чекає', 'чекають', 'чекають')} рішення. Показати лише їх`],
    [/^(\d+) results? for “(.*)”$/, (m) => `${pl(m[1], 'result')} за запитом «${m[2]}»`],
    [/^reminders?$/, () => 'нагадувань'],
    [/^(\d+) due$/, (m) => pl(m[1], 'charge')],
    [/^(\d+) due · (.+)$/, (m) => `${pl(m[1], 'charge')} · ${m[2]}`],
    [/^(\d+) due in (.+?) · (.+)$/, (m) => `${pl(m[1], 'charge')} у ${monthIn(m[2])} · ${m[3]}`],
    [/^(\d+) due in (.+)$/, (m) => `${pl(m[1], 'charge')} у ${monthIn(m[2])}`],
    [/^Nothing due in (.+)$/, (m) => `У ${monthIn(m[1])} нічого не списується`],
    [/^Nothing else is due in (.+)\.$/, (m) => `Більше нічого не списується в ${monthIn(m[1])}.`],
    [/^Also in (.+)$/, (m) => `Також у ${monthIn(m[1])}`],
    [/^In ([^\d].*)$/, (m) => `У ${monthIn(m[1])}`],
    [/^(.+) so far$/, (m) => `${cap(m[1])}, поки що`],
    [/^All decided\.(?: Next renewal (today|tomorrow|in (\d+) days?)\.)?$/, (m) => `Усе вирішено.${m[1] ? ` Наступне списання ${m[2] ? 'через ' + pl(m[2], 'day') : tr(m[1])}.` : ''}`],
    // labels with a count: "Documents · 2", "Next 30 days · 10"
    [/^(.+) · (\d+)$/, (m) => `${tr(m[1])} · ${m[2]}`],
    // charts
    [/^(.+): (.+) a year\. Show in the calendar$/, (m) => `${tr(m[1])}: ${m[2]} на рік. Показати в календарі`],
    [/^(.+): (.+)\. Open in the calendar$/, (m) => `${cap(m[1])}: ${m[2]}. Відкрити в календарі`],
    [/^(.+) are the biggest share: (\d+)% of your yearly total\.$/, (m) => `Найбільша частка — ${tr(m[1]).toLowerCase()}: ${m[2]}% усіх витрат за рік.`],
    [/^All your yearly costs are (.+)\.$/, (m) => `Усі витрати за рік — це ${tr(m[1].charAt(0).toUpperCase() + m[1].slice(1)).toLowerCase()}.`],
    [/^Peaks in (.+?)(?: and (.+))?\.$/, (m) => `Найбільше списань у ${monthIn(m[1])}${m[2] ? ' і ' + monthIn(m[2]) : ''}.`],
    // search
    [/^No reminders match “(.*)”\.$/, (m) => `За запитом «${m[1]}» нічого немає.`],
    [/^Enter “(.*)” manually$/, (m) => `Ввести «${m[1]}» вручну`],
    [/^Add (.+)$/, (m) => `Додати ${m[1]}`],
    // services & plans
    [/^(.+) plan$/, (m) => `Тариф ${tr(m[1])}`],
    [/^Cancel on (.+) \(opens in a new tab\)$/, (m) => `Скасувати на ${m[1]} (відкриється в новій вкладці)`],
    [/^Opens (.+) in a new tab\.$/, (m) => `Відкриє ${m[1]} у новій вкладці.`],
    // reminders, follow-ups, history
    [/^renews (.+)$/, (m) => `списання ${m[1]}`],
    [/^We’ll remind you again tomorrow, (.+)$/, (m) => `Нагадаємо ще раз завтра, ${m[1]}`],
    [/^We’ll remind you again on (.+)$/, (m) => `Нагадаємо ще раз ${m[1]}`],
    [/^Follow-up on (.+)\.$/, (m) => `Повторне нагадування ${m[1]}.`],
    [/^Your note: “(.*)”$/, (m) => `Твоя нотатка: «${tr(m[1])}»`],
    [/^Postponed because: (.+)$/, (m) => `Відкладено, бо: ${tr(m[1]).toLowerCase()}`],
    [/^Reason saved: (.+)\.$/, (m) => `Причину збережено: ${tr(m[1]).toLowerCase()}.`],
    [/^Reminder sent \((\d+) days before\)$/, (m) => `Нагадування надіслано (за ${pl(m[1], 'day')})`],
    [/^Reminder sent \(on the day\)$/, () => 'Нагадування надіслано (у день списання)'],
    [/^Reminder (?:sent|emailed)(.*)$/, (m) => `Нагадування надіслано${m[1]}`],
    [/^Time to decide on (.+)$/, (m) => `Час вирішити щодо ${m[1]}`],
    [/^Your monthly total is now (.+)\.$/, (m) => `Тепер на місяць виходить ${m[1]}.`],
    [/^· “(.*)”$/, (m) => `· «${tr(m[1])}»`],
    [/^Follow-up on (.+?)\.$/, (m) => `Повторне нагадування ${m[1]}.`],
    [/^(.+) (renews|expires) on (.+?)(?:, ([^,]+?))?\. We’ll remind you on (.+)\.$/, (m) => `${tr(m[1])}: ${m[2] === 'renews' ? 'списання' : 'спливає'} ${m[3]}${m[4] ? ', ' + m[4] : ''}. Нагадаємо ${m[5]}.`],
    [/^(.+) (renews|expires) (today|tomorrow|in (\d+) days?)$/, (m) => `${tr(m[1])}: ${m[2] === 'renews' ? 'списання' : 'спливає'} ${m[4] ? 'через ' + pl(m[4], 'day') : tr(m[3])}`],
    [/^(.+) (renews|expires)(?: · (.+))?$/, (m) => `${m[1] === 'It' ? 'Воно' : tr(m[1])}: ${m[2] === 'renews' ? 'списання' : 'спливає'}${m[3] ? ' · ' + m[3] : ''}`],
    [/^We remind you \((email|browser)\)$/, (m) => `Нагадаємо (${m[1] === 'email' ? 'на email' : 'у браузері'})`],
    [/^Edit (.+)$/, (m) => `Змінити «${tr(m[1])}»`],
    [/^Your charge is (?:(today or past)|in (\d+) days?) — too late for (\d+) days before$/, (m) => `Списання ${m[1] ? 'сьогодні або вже минуло' : 'через ' + pl(m[2], 'day')} — за ${pl(m[3], 'day')} уже не встигнемо`],
    [/^Choose a date, (.+)$/, (m) => `Обрати дату, ${m[1]}`],
    [/^Delete the (.+) reminder\?$/, (m) => `Видалити нагадування «${tr(m[1])}»?`],
    [/^This removes the reminder, its note and history from Renewal Reminder\. It doesn’t cancel your (.+) subscription\.$/, (m) => `Зникнуть нагадування, нотатка та історія. Саму підписку ${tr(m[1])} це не скасує.`],
    [/^Pick a date on or before (.+) — after that, (.+) renews before you decide\.$/, (m) => `Обери дату не пізніше ${m[1]} — інакше ${m[2]} продовжиться раніше, ніж ти вирішиш.`],
    [/^Not later than (.+): after that, (.+) renews before you decide\.$/, (m) => `Не пізніше ${m[1]}: інакше ${m[2]} продовжиться раніше, ніж ти вирішиш.`],
    [/^Pick a reminder before the next one on (.+)\.$/, (m) => `Обери нагадування до наступного списання ${m[1]}.`],
    // toasts
    [/^(.+): marked as cancelled$/, (m) => `${m[1]}: скасовано — мінус одна витрата 💪`],
    [/^(.+): kept$/, (m) => `${m[1]}: залишаємо 👍`],
    [/^(.+) saved as “Decide later”$/, (m) => `${m[1]}: рішення відкладено`],
    [/^(.+): we’ll remind you on (.+)$/, (m) => `${m[1]}: нагадаємо ${m[2]}`],
    [/^(.+) reminder deleted$/, (m) => `Нагадування «${tr(m[1])}» видалено`],
    [/^(.+) saved$/, (m) => `${m[1]}: збережено`],
    [/^We emailed (.+) about (.+)\. Check Spam if it’s not in your inbox\.$/, (m) => `Написали на ${m[1]} про ${m[2]}. Якщо листа немає — зазирни в «Спам».`],
    [/^Reminder by email to (.+)\.$/, (m) => `Нагадаємо листом на ${m[1]}.`],
    [/^Test email sent to (.+)\. It can take a minute; if it’s not in your inbox, check Spam\.$/, (m) => `Тестовий лист надіслано на ${m[1]}. Може йти хвилинку; якщо немає — глянь у «Спам».`],
    [/^Test email sent for (.+)$/, (m) => `Тестовий лист для ${m[1]} надіслано`],
    [/^It went to (.+)\.$/, (m) => `Пішов на ${m[1]}.`],
    [/^Confirmation link sent to (.+)\. Open it, then send the test email again\.$/, (m) => `Посилання для підтвердження надіслано на ${m[1]}. Відкрий його й надішли тестовий лист ще раз.`],
    [/^Amounts converted to (.+)$/, (m) => `Суми переведено в ${m[1]}`],
    [/^· in (\w+) at today’s rate$/, (m) => `· у ${m[1]} за сьогоднішнім курсом`],
    [/^Exchange rate from (.+)$/, (m) => `Курс від ${m[1]}`],
    [/^(.+) — (.+), (.+)$/, null], // placeholder (skipped below)
  );
  // drop placeholders
  for (let i = PATTERNS.length - 1; i >= 0; i--) if (!PATTERNS[i][1]) PATTERNS.splice(i, 1);
  // Generic fallback: "A · B · C" → translate each part.
  PATTERNS.push([/^(.+?) · (.+)$/, (m) => m[0].split(' · ').map((x) => tr(x)).join(' · ')]);
})();
