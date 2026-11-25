import {
  ANTHROPIC_PRIVACY, ANTHROPIC_RETENTION, CNPD_COMPLAINTS, GONATIVE_PRIVACY, GOOGLE_PRIVACY, OPERATOR, OPERATOR_ADDRESS,
  SUPPORT_EMAIL, TERMS_VERSION, type LegalDocument,
} from './common';

// Draft for the owner's review before the Phase 3 deploy (P3 §6, question 3). Facts follow the
// MultiAdmin Exams module: encrypted essays, ExamsDataPurger, Anthropic as the only AI provider.

const en: LegalDocument = {
  title: 'GoNative Exams Privacy Policy',
  version: `Version ${TERMS_VERSION}`,
  intro: 'This Policy explains how we handle personal data when you use GoNative Exams: sign in, write practice essays and receive automated feedback. The shared GoNative account also falls under the GoNative Privacy Policy.',
  summary: [
    'When you submit an essay for feedback, its text and the task are sent to our AI provider, Anthropic. They are not used to train AI models.',
    'Drafts are saved to your account and are not sent to AI. Your essays are private, stored encrypted and never published.',
    'You can delete any essay, or all your Exams data, in the service at any time.',
  ],
  sections: [
    {id: 'controller', title: 'Who is responsible for your data', body: [
      `${OPERATOR}, an individual, is the controller of the personal data described here. Address: ${OPERATOR_ADDRESS}.`,
      `For privacy requests, write to ${SUPPORT_EMAIL} from your account email. Do not send your password.`,
    ], links: [{label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}`}]},
    {id: 'data', title: 'What we collect', items: [
      'Account and sign-in data: email, user identifier, name if provided, password authentication data, and the Google account identifier if you use Google sign-in. We do not receive your Google password.',
      'Exams profile: interface and feedback languages, the exam you prepare for, an optional target score and exam date, your confirmation that you are 16 or older, and the accepted version of these documents.',
      'Essays: the task you chose or wrote, the text of your essay and its drafts, word counts and dates.',
      'Feedback: approximate score ranges per criterion, findings with short quotes from your essay, explanations, and skill statistics derived from them.',
      'What you send us: reports about feedback (with your optional permission to let an administrator read the essay), and official exam results you choose to enter.',
      'Service records: plan and monthly usage, records of AI requests (cost, size and timing, without the essay text), and errors. Technical request data, such as IP address, browser information and request time.',
    ], body: ['Write your own essays and do not include personal data about yourself or others in them: they are practice texts, not a place for private information.']},
    {id: 'ai', title: 'Automated feedback and AI', body: [
      'Drafts stay on our server and are not sent to AI. When you submit an essay, we first run automatic checks on our server (for example, whether the text is long enough and in English). Unless these checks already decide the result, its text, the task and the chosen feedback language are sent to Anthropic, the provider of the Claude AI models, which returns the feedback.',
      'Anthropic processes this data for us under its commercial terms and data processing addendum. It does not use our API data to train its models. It may keep API inputs and outputs for a limited time, up to 30 days, to detect misuse, and then deletes them. Anthropic is in the United States; this transfer relies on standard contractual clauses.',
      'Feedback is produced automatically, without a human reviewer, unless you report it and allow an administrator to read the essay. Score ranges are approximate practice estimates, not official results, and are not used to make decisions about you.',
    ], links: [{label: 'Anthropic Privacy Policy', href: ANTHROPIC_PRIVACY}, {label: 'Anthropic API data retention', href: ANTHROPIC_RETENTION}]},
    {id: 'purposes', title: 'Why we use it', items: [
      'To perform our agreement with you: run your account, save drafts, produce feedback, keep your history and show your progress.',
      'For our legitimate interests in security, reliability and cost control: enforce usage limits, prevent abuse, investigate errors and measure feedback quality using counts and statistics, not essay texts.',
      'With your consent, which you can withdraw at any time: using the official results you enter to check our estimates in aggregate (calibration), and letting an administrator read an essay you reported.',
      'To meet legal obligations and deal with claims where necessary.',
    ]},
    {id: 'calibration', title: 'Official results you enter', body: [
      'You may enter the scores from an official exam you took. Without separate consent, they are only shown to you next to our earlier estimates. With your consent, they are also used, together with many other people’s results, to measure how far our estimates are from official scores. A single person’s result is never treated as a reference for that person. You can withdraw consent or delete the result at any time. Do not upload score reports: enter only the numbers and the date.',
    ]},
    {id: 'cookies', title: 'Cookies, browser storage and Google sign-in', items: [
      'A necessary session cookie keeps you signed in for up to 30 days, or until you sign out.',
      'A language cookie remembers your interface language for up to one year. Your theme choice is stored in this browser.',
      'While you write, a copy of your draft is kept in this browser so that a closed tab or a lost connection does not lose your text. It is removed after you submit or delete the essay and when you sign out.',
      'Exams uses no advertising or analytics cookies.',
      'The Google sign-in button may load on sign-in and registration pages. Google receives technical data needed to display it. If you choose Google sign-in, we receive the verified account details needed to authenticate you.',
    ], links: [{label: 'Google Privacy Policy', href: GOOGLE_PRIVACY}]},
    {id: 'sharing', title: 'Who can receive data', items: [
      'Anthropic, for automated feedback, as described above.',
      'Hosting and email services, as needed to run Exams and send service emails such as account confirmation.',
      'Google, for sign-in if you use it.',
      'Professional advisers, or authorities when disclosure is required by law.',
    ], body: ['We do not sell personal data, show advertising or publish your essays.']},
    {id: 'retention', title: 'Storage and deletion', items: [
      'Essays and their feedback stay in your history until you delete them. Deleting an essay permanently deletes its text, its feedback and the AI processing records that contain quotes from it.',
      'In Settings you can delete all your Exams data: essays, feedback, statistics, reports and entered results. Deletion requires your current password. A minimal counter of this month’s usage is kept so that deleting data does not reset limits. Your GoNative account and other GoNative products are not affected.',
      'You can also close your whole GoNative account, which deletes your data in every GoNative product.',
      'Records of AI requests keep only numbers (cost, size, time) after an essay is deleted. Technical logs never contain essay texts.',
      'Backup copies of the database currently have no configured automatic expiry and may contain deleted data until they are overwritten. Contact us about erasure of this data as well.',
    ], body: ['Essay texts are encrypted in our database. We use HTTPS and access controls. No online service can guarantee absolute security.']},
    {id: 'rights', title: 'Your rights', items: [
      'Request access to your personal data, a copy, and correction of inaccurate information.',
      'Request erasure, restriction or portability where applicable, or object to processing based on legitimate interests.',
      'Withdraw consent where processing relies on it, without affecting earlier lawful processing.',
      'Complain to the data protection authority in your country or Portugal’s Comissão Nacional de Proteção de Dados (CNPD).',
    ], body: [`Write to ${SUPPORT_EMAIL}. We may need to verify your identity. We respond within the period required by law, normally one month.`],
    links: [{label: 'Submit a complaint to CNPD', href: CNPD_COMPLAINTS}]},
    {id: 'age-changes', title: 'Age and Policy updates', body: [
      'GoNative Exams is for people aged 16 and over. If you are younger, do not use it.',
      'When our processing changes, we will update this page and ask you to accept the new version before you continue. The version at the top identifies this text. For the rest of the shared GoNative account and GoNative apps, see the GoNative Privacy Policy.',
    ], links: [{label: 'GoNative Privacy Policy', href: GONATIVE_PRIVACY}, {label: 'GoNative Exams Terms of Use', href: '/terms'}]},
  ],
};

const ru: LegalDocument = {
  title: 'Политика конфиденциальности GoNative Exams',
  version: `Редакция ${TERMS_VERSION}`,
  intro: 'Здесь описано, как мы обращаемся с персональными данными, когда вы пользуетесь GoNative Exams: входите в аккаунт, пишете эссе для практики и получаете автоматический разбор. Для общего аккаунта GoNative также действует политика GoNative.',
  summary: [
    'Когда вы отправляете эссе на разбор, его текст и задание передаются нашему AI-провайдеру — компании Anthropic. Для обучения моделей они не используются.',
    'Черновики сохраняются в вашем аккаунте и в AI не отправляются. Эссе приватны, хранятся в зашифрованном виде и не публикуются.',
    'Любое эссе или все данные Exams можно удалить в сервисе в любой момент.',
  ],
  sections: [
    {id: 'controller', title: 'Кто отвечает за данные', body: [
      `Контролёр описанных здесь персональных данных — физическое лицо ${OPERATOR}. Адрес: ${OPERATOR_ADDRESS}.`,
      `По вопросам конфиденциальности пишите на ${SUPPORT_EMAIL} с email вашего аккаунта. Пароль отправлять не нужно.`,
    ], links: [{label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}`}]},
    {id: 'data', title: 'Какие данные мы получаем', items: [
      'Аккаунт и вход: email, идентификатор пользователя, имя, если оно указано, данные для проверки пароля и идентификатор аккаунта Google при входе через Google. Пароль от Google мы не получаем.',
      'Профиль Exams: языки интерфейса и объяснений, экзамен, к которому вы готовитесь, необязательные целевой балл и дата экзамена, ваше подтверждение, что вам есть 16 лет, и принятая редакция этих документов.',
      'Эссе: выбранное или своё задание, текст эссе и его черновики, число слов и даты.',
      'Разбор: ориентировочные диапазоны по критериям, замечания с короткими цитатами из эссе, объяснения и статистика навыков, рассчитанная по ним.',
      'То, что вы присылаете сами: жалобы на разбор (с вашим необязательным разрешением показать эссе администратору) и официальные результаты экзамена, если вы их вводите.',
      'Служебные записи: тариф и использование за месяц, записи об AI-запросах (стоимость, объём и время — без текста эссе), ошибки. Технические данные запросов: IP-адрес, сведения о браузере, время запроса.',
    ], body: ['Пишите эссе сами и не включайте в них персональные данные о себе или других людях: это тексты для практики, а не место для личной информации.']},
    {id: 'ai', title: 'Автоматический разбор и AI', body: [
      'Черновики остаются на нашем сервере и в AI не отправляются. Когда вы отправляете эссе, сначала на нашем сервере выполняются автоматические проверки (например, достаточно ли текст длинный и написан ли он на английском). Если эти проверки сами не определяют результат, текст эссе, задание и выбранный язык объяснений передаются компании Anthropic — поставщику моделей Claude, — и она возвращает разбор.',
      'Anthropic обрабатывает эти данные по нашему поручению на условиях своего коммерческого соглашения и соглашения об обработке данных. Данные, полученные через API, она не использует для обучения моделей. Она может хранить запросы и ответы API ограниченное время, до 30 дней, для выявления злоупотреблений, после чего удаляет их. Anthropic находится в США; передача основана на стандартных договорных условиях.',
      'Разбор создаётся автоматически, без проверки человеком, — если только вы не пожалуетесь на него и не разрешите администратору прочитать эссе. Диапазоны баллов — ориентировочная оценка для практики, а не официальный результат; решения о вас на их основе не принимаются.',
    ], links: [{label: 'Политика конфиденциальности Anthropic', href: ANTHROPIC_PRIVACY}, {label: 'Хранение данных API у Anthropic', href: ANTHROPIC_RETENTION}]},
    {id: 'purposes', title: 'Для чего они нужны', items: [
      'Для выполнения договора с вами: работы аккаунта, сохранения черновиков, разбора эссе, истории и прогресса.',
      'Для наших законных интересов в безопасности, надёжности и контроле расходов: соблюдения лимитов, защиты от злоупотреблений, разбора ошибок и измерения качества разбора по числам и статистике, без текстов эссе.',
      'С вашего согласия, которое можно отозвать в любой момент: для проверки наших оценок по введённым вами официальным результатам в агрегированном виде (калибровка) и для просмотра администратором эссе, на разбор которого вы пожаловались.',
      'Для выполнения требований закона и рассмотрения претензий, когда это необходимо.',
    ]},
    {id: 'calibration', title: 'Официальные результаты, которые вы вводите', body: [
      'Вы можете ввести баллы сданного официального экзамена. Без отдельного согласия они видны только вам — рядом с нашими прошлыми оценками. С вашим согласием они также используются вместе с результатами многих других людей, чтобы измерить, насколько наши оценки отличаются от официальных. Результат одного человека никогда не считается эталоном для него самого. Согласие можно отозвать, а результат удалить в любой момент. Не загружайте сертификаты: вводите только баллы и дату.',
    ]},
    {id: 'cookies', title: 'Cookies, хранилище браузера и вход через Google', items: [
      'Необходимый cookie сеанса сохраняет вход на срок до 30 дней или до выхода из аккаунта.',
      'Cookie языка запоминает язык интерфейса на срок до года. Выбранная тема хранится в этом браузере.',
      'Пока вы пишете, копия черновика хранится в этом браузере, чтобы закрытая вкладка или обрыв связи не стёрли текст. Она удаляется после отправки или удаления эссе и при выходе из аккаунта.',
      'Рекламных и аналитических cookies в Exams нет.',
      'На страницах входа и регистрации может загружаться кнопка Google. Для её отображения Google получает технические данные. Если выбрать вход через Google, мы получим подтверждённые сведения об аккаунте, необходимые для входа.',
    ], links: [{label: 'Политика конфиденциальности Google', href: GOOGLE_PRIVACY}]},
    {id: 'sharing', title: 'Кому могут передаваться данные', items: [
      'Anthropic — для автоматического разбора, как описано выше.',
      'Сервисам хостинга и электронной почты — для работы Exams и отправки служебных писем, например подтверждения аккаунта.',
      'Google — для входа, если вы им пользуетесь.',
      'Профессиональным консультантам и органам власти, когда этого требует закон.',
    ], body: ['Мы не продаём персональные данные, не показываем рекламу и не публикуем ваши эссе.']},
    {id: 'retention', title: 'Хранение и удаление', items: [
      'Эссе и их разборы хранятся в истории, пока вы их не удалите. Удаление эссе безвозвратно удаляет его текст, разбор и записи AI-обработки, в которых есть цитаты из него.',
      'В настройках можно удалить все данные Exams: эссе, разборы, статистику, жалобы и введённые результаты. Для подтверждения нужен текущий пароль. Сохраняется минимальный счётчик использования за текущий месяц, чтобы удаление данных не сбрасывало лимиты. Аккаунт GoNative и другие продукты GoNative это не затрагивает.',
      'Можно также закрыть весь аккаунт GoNative — тогда удаляются ваши данные во всех продуктах GoNative.',
      'После удаления эссе в записях об AI-запросах остаются только числа (стоимость, объём, время). Текстов эссе в технических журналах нет.',
      'Для резервных копий базы данных сейчас не настроен срок автоматического удаления; удалённые данные могут оставаться в них, пока копии не будут перезаписаны. По поводу удаления этих данных тоже можно обратиться к нам.',
    ], body: ['Тексты эссе хранятся в базе данных в зашифрованном виде. Мы используем HTTPS и разграничение доступа. Ни один онлайн-сервис не может гарантировать абсолютную безопасность.']},
    {id: 'rights', title: 'Ваши права', items: [
      'Запросить доступ к своим данным, их копию и исправление неточной информации.',
      'Запросить удаление, ограничение обработки или перенос данных, когда это применимо, а также возразить против обработки на основании законных интересов.',
      'Отозвать согласие, если обработка основана на нём; это не влияет на законность предыдущей обработки.',
      'Подать жалобу в орган защиты данных своей страны или в португальскую Comissão Nacional de Proteção de Dados (CNPD).',
    ], body: [`Пишите на ${SUPPORT_EMAIL}. Может потребоваться подтверждение личности. Мы отвечаем в предусмотренный законом срок — как правило, в течение месяца.`],
    links: [{label: 'Подать жалобу в CNPD', href: CNPD_COMPLAINTS}]},
    {id: 'age-changes', title: 'Возраст и обновления политики', body: [
      'GoNative Exams — для пользователей от 16 лет. Если вам меньше, не пользуйтесь сервисом.',
      'При изменении обработки данных мы обновим эту страницу и попросим принять новую редакцию, прежде чем продолжить. Редакцию обозначает номер в начале страницы. Для остальных функций общего аккаунта и приложений GoNative действует политика GoNative.',
    ], links: [{label: 'Политика конфиденциальности GoNative', href: GONATIVE_PRIVACY}, {label: 'Условия использования GoNative Exams', href: '/terms'}]},
  ],
};

const uk: LegalDocument = {
  title: 'Політика конфіденційності GoNative Exams',
  version: `Редакція ${TERMS_VERSION}`,
  intro: 'Тут описано, як ми поводимося з персональними даними, коли ви користуєтеся GoNative Exams: входите в акаунт, пишете есе для практики й отримуєте автоматичний розбір. Для спільного акаунта GoNative також діє політика GoNative.',
  summary: [
    'Коли ви надсилаєте есе на розбір, його текст і завдання передаються нашому AI-провайдерові — компанії Anthropic. Для навчання моделей вони не використовуються.',
    'Чернетки зберігаються у вашому акаунті й в AI не надсилаються. Есе приватні, зберігаються в зашифрованому вигляді й не публікуються.',
    'Будь-яке есе або всі дані Exams можна видалити в сервісі будь-коли.',
  ],
  sections: [
    {id: 'controller', title: 'Хто відповідає за дані', body: [
      `Контролер описаних тут персональних даних — фізична особа ${OPERATOR}. Адреса: ${OPERATOR_ADDRESS}.`,
      `З питань конфіденційності пишіть на ${SUPPORT_EMAIL} з email вашого акаунта. Пароль надсилати не потрібно.`,
    ], links: [{label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}`}]},
    {id: 'data', title: 'Які дані ми отримуємо', items: [
      'Акаунт і вхід: email, ідентифікатор користувача, ім’я, якщо його вказано, дані для перевірки пароля та ідентифікатор акаунта Google під час входу через Google. Пароль від Google ми не отримуємо.',
      'Профіль Exams: мови інтерфейсу й пояснень, іспит, до якого ви готуєтеся, необов’язкові цільовий бал і дата іспиту, ваше підтвердження, що вам є 16 років, і прийнята редакція цих документів.',
      'Есе: вибране або своє завдання, текст есе та його чернетки, кількість слів і дати.',
      'Розбір: орієнтовні діапазони за критеріями, зауваження з короткими цитатами з есе, пояснення й статистика навичок, розрахована за ними.',
      'Те, що ви надсилаєте самі: скарги на розбір (з вашим необов’язковим дозволом показати есе адміністраторові) та офіційні результати іспиту, якщо ви їх вводите.',
      'Службові записи: тариф і використання за місяць, записи про AI-запити (вартість, обсяг і час — без тексту есе), помилки. Технічні дані запитів: IP-адреса, відомості про браузер, час запиту.',
    ], body: ['Пишіть есе самі й не включайте в них персональні дані про себе чи інших людей: це тексти для практики, а не місце для особистої інформації.']},
    {id: 'ai', title: 'Автоматичний розбір і AI', body: [
      'Чернетки залишаються на нашому сервері й в AI не надсилаються. Коли ви надсилаєте есе, спочатку на нашому сервері виконуються автоматичні перевірки (наприклад, чи достатньо довгий текст і чи написаний він англійською). Якщо ці перевірки самі не визначають результат, текст есе, завдання й вибрана мова пояснень передаються компанії Anthropic — постачальникові моделей Claude, — і вона повертає розбір.',
      'Anthropic обробляє ці дані за нашим дорученням на умовах своєї комерційної угоди й угоди про обробку даних. Дані, отримані через API, вона не використовує для навчання моделей. Вона може зберігати запити й відповіді API обмежений час, до 30 днів, для виявлення зловживань, після чого видаляє їх. Anthropic розташована в США; передавання ґрунтується на стандартних договірних умовах.',
      'Розбір створюється автоматично, без перевірки людиною, — якщо тільки ви не поскаржитеся на нього й не дозволите адміністраторові прочитати есе. Діапазони балів — орієнтовна оцінка для практики, а не офіційний результат; рішення щодо вас на їхній основі не ухвалюються.',
    ], links: [{label: 'Політика конфіденційності Anthropic', href: ANTHROPIC_PRIVACY}, {label: 'Зберігання даних API в Anthropic', href: ANTHROPIC_RETENTION}]},
    {id: 'purposes', title: 'Для чого вони потрібні', items: [
      'Для виконання договору з вами: роботи акаунта, збереження чернеток, розбору есе, історії та прогресу.',
      'Для наших законних інтересів у безпеці, надійності й контролі витрат: дотримання лімітів, захисту від зловживань, розбору помилок і вимірювання якості розбору за числами й статистикою, без текстів есе.',
      'З вашої згоди, яку можна відкликати будь-коли: для перевірки наших оцінок за введеними вами офіційними результатами в агрегованому вигляді (калібрування) і для перегляду адміністратором есе, на розбір якого ви поскаржилися.',
      'Для виконання вимог закону й розгляду претензій, коли це необхідно.',
    ]},
    {id: 'calibration', title: 'Офіційні результати, які ви вводите', body: [
      'Ви можете ввести бали складеного офіційного іспиту. Без окремої згоди їх бачите лише ви — поруч із нашими минулими оцінками. З вашою згодою вони також використовуються разом із результатами багатьох інших людей, щоб виміряти, наскільки наші оцінки відрізняються від офіційних. Результат однієї людини ніколи не вважається еталоном для неї самої. Згоду можна відкликати, а результат видалити будь-коли. Не завантажуйте сертифікати: вводьте лише бали й дату.',
    ]},
    {id: 'cookies', title: 'Cookies, сховище браузера й вхід через Google', items: [
      'Необхідний cookie сеансу зберігає вхід на строк до 30 днів або до виходу з акаунта.',
      'Cookie мови запам’ятовує мову інтерфейсу на строк до року. Вибрана тема зберігається в цьому браузері.',
      'Поки ви пишете, копія чернетки зберігається в цьому браузері, щоб закрита вкладка чи обрив зв’язку не стерли текст. Вона видаляється після надсилання або видалення есе й під час виходу з акаунта.',
      'Рекламних та аналітичних cookies в Exams немає.',
      'На сторінках входу й реєстрації може завантажуватися кнопка Google. Для її показу Google отримує технічні дані. Якщо вибрати вхід через Google, ми отримаємо підтверджені відомості про акаунт, потрібні для входу.',
    ], links: [{label: 'Політика конфіденційності Google', href: GOOGLE_PRIVACY}]},
    {id: 'sharing', title: 'Кому можуть передаватися дані', items: [
      'Anthropic — для автоматичного розбору, як описано вище.',
      'Сервісам хостингу й електронної пошти — для роботи Exams і надсилання службових листів, наприклад підтвердження акаунта.',
      'Google — для входу, якщо ви ним користуєтеся.',
      'Професійним консультантам і органам влади, коли цього вимагає закон.',
    ], body: ['Ми не продаємо персональні дані, не показуємо рекламу й не публікуємо ваші есе.']},
    {id: 'retention', title: 'Зберігання й видалення', items: [
      'Есе та їхні розбори зберігаються в історії, доки ви їх не видалите. Видалення есе безповоротно видаляє його текст, розбір і записи AI-обробки, у яких є цитати з нього.',
      'У налаштуваннях можна видалити всі дані Exams: есе, розбори, статистику, скарги й введені результати. Для підтвердження потрібен поточний пароль. Зберігається мінімальний лічильник використання за поточний місяць, щоб видалення даних не скидало ліміти. Акаунт GoNative та інші продукти GoNative це не зачіпає.',
      'Можна також закрити весь акаунт GoNative — тоді видаляються ваші дані в усіх продуктах GoNative.',
      'Після видалення есе в записах про AI-запити залишаються лише числа (вартість, обсяг, час). Текстів есе в технічних журналах немає.',
      'Для резервних копій бази даних зараз не налаштовано строк автоматичного видалення; видалені дані можуть залишатися в них, доки копії не буде перезаписано. Щодо видалення цих даних теж можна звернутися до нас.',
    ], body: ['Тексти есе зберігаються в базі даних у зашифрованому вигляді. Ми використовуємо HTTPS і розмежування доступу. Жоден онлайн-сервіс не може гарантувати абсолютну безпеку.']},
    {id: 'rights', title: 'Ваші права', items: [
      'Запитати доступ до своїх даних, їхню копію та виправлення неточної інформації.',
      'Запитати видалення, обмеження обробки або перенесення даних, коли це застосовно, а також заперечити проти обробки на підставі законних інтересів.',
      'Відкликати згоду, якщо обробка ґрунтується на ній; це не впливає на законність попередньої обробки.',
      'Подати скаргу до органу захисту даних своєї країни або до португальської Comissão Nacional de Proteção de Dados (CNPD).',
    ], body: [`Пишіть на ${SUPPORT_EMAIL}. Може знадобитися підтвердження особи. Ми відповідаємо у передбачений законом строк — як правило, протягом місяця.`],
    links: [{label: 'Подати скаргу до CNPD', href: CNPD_COMPLAINTS}]},
    {id: 'age-changes', title: 'Вік і оновлення політики', body: [
      'GoNative Exams — для користувачів від 16 років. Якщо вам менше, не користуйтеся сервісом.',
      'У разі зміни обробки даних ми оновимо цю сторінку й попросимо прийняти нову редакцію, перш ніж продовжити. Редакцію позначає номер на початку сторінки. Для інших функцій спільного акаунта й застосунків GoNative діє політика GoNative.',
    ], links: [{label: 'Політика конфіденційності GoNative', href: GONATIVE_PRIVACY}, {label: 'Умови використання GoNative Exams', href: '/terms'}]},
  ],
};

export const privacy = {en, ru, uk} as const;
