import {GONATIVE_TERMS, OPERATOR, OPERATOR_ADDRESS, SUPPORT_EMAIL, TERMS_VERSION, type LegalDocument} from './common';

// Draft for the owner's review before the Phase 3 deploy (P3 §6, question 3).
// Score wording follows ADR-003: approximate ranges only, never presented as official results.

const en: LegalDocument = {
  title: 'GoNative Exams Terms of Use',
  version: `Version ${TERMS_VERSION}`,
  intro: 'These Terms apply to GoNative Exams, a service for practising exam writing tasks with automated feedback.',
  summary: [
    'Feedback is automated and may contain mistakes. Score ranges are approximate practice estimates, not official results.',
    'GoNative Exams is not affiliated with or endorsed by IELTS or its owners. Practice tasks are our own, not official exam tasks.',
    'Your essays remain yours. Submit only your own writing and do not try to manipulate the feedback.',
  ],
  sections: [
    {id: 'account', title: 'The service and your account', body: [
      `GoNative Exams is operated by ${OPERATOR}, an individual, at ${OPERATOR_ADDRESS}. These Terms are an agreement between you and the operator. Accepting them when you start, or using Exams, means you agree to them.`,
    ], items: [
      'Exams uses your shared GoNative account: the same email and password as the GoNative app and Worksheets, or a supported sign-in provider. Exams has its own profile and sessions.',
      'You must be 16 or older and legally able to accept these Terms.',
      'Keep your sign-in details safe and tell us if you suspect unauthorized access.',
    ]},
    {id: 'feedback', title: 'What the feedback is, and what it is not', items: [
      'Feedback is produced automatically with AI models, without a human reviewer. It may miss mistakes, mark correct language as a problem, or explain something imprecisely. Use your own judgement and report feedback you think is wrong.',
      'Score ranges are deliberately broad estimates for practice. They are not official results, not a prediction of your exam score, and not a statement that you are ready for the exam.',
      'IELTS is a registered trademark of its owners. GoNative Exams is not affiliated with, endorsed by or connected to them. Practice tasks are written by us and are not official exam tasks.',
      'Exams is a preparation tool and does not guarantee any exam result.',
    ]},
    {id: 'limits', title: 'Plans and usage limits', items: [
      'Current free limits, such as the number of feedback requests per month, are shown in the service. We may change them, and will show the current limits before you submit.',
      'A request is counted when an essay is accepted for AI feedback. Resubmitting exactly the same text returns the existing feedback and is not counted again. Essays that our automatic checks assess without AI (for example, very short texts) are not counted.',
      'Paid plans, when available, will be described in the service before any purchase.',
    ]},
    {id: 'content', title: 'Your essays and permitted use', items: [
      'You keep the rights to your essays and to tasks you write. You allow us to store and process them, including sending them to our AI provider, to save drafts, produce feedback and show your history and progress.',
      'We do not publish your essays, show them to other users or use them to train AI models.',
      'Submit only text you wrote yourself or are entitled to use. Do not include personal data about other people.',
      'Our practice tasks, explanations, software and design belong to us or our licensors. You may use the tasks and feedback for your own learning; you may not copy them in bulk, resell them or use them to build a competing product or train AI models.',
    ]},
    {id: 'acceptable-use', title: 'Acceptable use', body: ['You may not:'], items: [
      'try to manipulate the feedback, for example by hiding instructions for the AI inside an essay;',
      'submit essays automatically or in bulk, share your account, or bypass limits or security measures;',
      'access other users’ accounts or data, scrape the service or disrupt its operation;',
      'submit unlawful or harmful content, or decompile or reverse engineer the service, except where the law expressly allows it.',
    ]},
    {id: 'privacy-deletion', title: 'Privacy and deletion', body: [
      'The GoNative Exams Privacy Policy explains what data we process, including what is sent to our AI provider, and how to exercise your rights.',
    ], items: [
      'You can delete any essay from your history. Deletion is permanent.',
      'In Settings you can delete all your Exams data while keeping your GoNative account, or close the whole GoNative account, which affects every GoNative product.',
    ], links: [{label: 'GoNative Exams Privacy Policy', href: '/privacy'}]},
    {id: 'availability', title: 'Availability and account restrictions', items: [
      'Features, exams, tasks and limits may change. Feedback may be temporarily unavailable, for example for maintenance or if our AI provider is unavailable.',
      'You may stop using Exams at any time. We may restrict or close access for serious or repeated breaches, misuse of the feedback, security risks or legal requirements. When reasonable, we will explain the reason and let you respond.',
    ]},
    {id: 'liability', title: 'Liability and applicable law', body: [
      'To the extent permitted by law, Exams is provided “as is” and “as available”. We are not liable for indirect or consequential losses, for exam results, or for losses caused by feedback errors, third-party services or events beyond our reasonable control. Our total liability for Exams claims is limited to what you paid for Exams in the preceding 12 months. This does not limit liability that the law does not allow us to limit, or your statutory consumer rights.',
      'Portuguese law applies. Consumers retain the protection of mandatory laws in their country of residence and may bring claims before its courts. Please contact us first so we can try to resolve the issue.',
    ]},
    {id: 'changes-contact', title: 'Changes and contact', body: [
      'If these Terms change, the new version will appear here and you will be asked to accept it before continuing. If you disagree, you may stop using Exams and delete your data.',
      'GoNative’s Terms apply to the shared account and GoNative apps. For Exams-specific matters, these Terms prevail. If translations differ, the English version prevails unless local law requires otherwise.',
      `For questions about Exams or these Terms, write to ${SUPPORT_EMAIL}.`,
    ], links: [{label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}`}, {label: 'GoNative Terms of Use', href: GONATIVE_TERMS}]},
  ],
};

const ru: LegalDocument = {
  title: 'Условия использования GoNative Exams',
  version: `Редакция ${TERMS_VERSION}`,
  intro: 'Эти условия относятся к GoNative Exams — сервису для практики письменных заданий экзаменов с автоматическим разбором.',
  summary: [
    'Разбор создаётся автоматически и может содержать ошибки. Диапазоны баллов — ориентировочная оценка для практики, а не официальный результат.',
    'GoNative Exams не связан с IELTS и её владельцами и не одобрен ими. Задания для практики — наши собственные, а не официальные экзаменационные.',
    'Ваши эссе остаются вашими. Отправляйте только свои тексты и не пытайтесь повлиять на разбор.',
  ],
  sections: [
    {id: 'account', title: 'Сервис и ваш аккаунт', body: [
      `GoNative Exams управляет физическое лицо ${OPERATOR}, адрес: ${OPERATOR_ADDRESS}. Эти условия — соглашение между вами и оператором. Принимая их при первом входе или пользуясь Exams, вы соглашаетесь с ними.`,
    ], items: [
      'Exams работает с общим аккаунтом GoNative: тот же email и пароль, что в приложении GoNative и Worksheets, или поддерживаемый способ входа. У Exams свой профиль и свои сеансы.',
      'Вам должно быть не меньше 16 лет, и вы должны иметь право принять эти условия.',
      'Храните данные для входа в безопасности и сообщите нам, если подозреваете чужой доступ.',
    ]},
    {id: 'feedback', title: 'Что такое разбор и чем он не является', items: [
      'Разбор создаётся автоматически с помощью AI-моделей, без проверки человеком. Он может пропустить ошибку, отметить правильное как проблему или неточно что-то объяснить. Полагайтесь и на собственное суждение и жалуйтесь на разбор, если считаете его неверным.',
      'Диапазоны баллов — намеренно широкая оценка для практики. Это не официальный результат, не прогноз вашего балла на экзамене и не вывод о готовности к нему.',
      'IELTS — зарегистрированная торговая марка её владельцев. GoNative Exams с ними не связан, ими не одобрен и не аффилирован. Задания для практики написаны нами и не являются официальными экзаменационными заданиями.',
      'Exams — инструмент подготовки и не гарантирует никакого результата экзамена.',
    ]},
    {id: 'limits', title: 'Тарифы и лимиты', items: [
      'Действующие бесплатные лимиты — например, число разборов в месяц — показаны в сервисе. Мы можем их менять и всегда показываем текущие лимиты перед отправкой.',
      'Разбор засчитывается, когда эссе принято на AI-разбор. Повторная отправка точно того же текста возвращает готовый разбор и не засчитывается снова. Эссе, которые наши автоматические проверки оценивают без AI (например, очень короткие тексты), не засчитываются.',
      'Платные тарифы, когда они появятся, будут описаны в сервисе до покупки.',
    ]},
    {id: 'content', title: 'Ваши эссе и допустимое использование', items: [
      'Права на ваши эссе и написанные вами задания остаются за вами. Вы разрешаете нам хранить и обрабатывать их, в том числе передавать нашему AI-провайдеру, чтобы сохранять черновики, делать разбор и показывать историю и прогресс.',
      'Мы не публикуем ваши эссе, не показываем их другим пользователям и не используем их для обучения AI-моделей.',
      'Отправляйте только тексты, которые написали сами или вправе использовать. Не включайте в них персональные данные других людей.',
      'Наши задания для практики, объяснения, программное обеспечение и дизайн принадлежат нам или нашим лицензиарам. Задания и разборы можно использовать для собственного обучения; нельзя массово копировать их, перепродавать или использовать для создания конкурирующего продукта и обучения AI-моделей.',
    ]},
    {id: 'acceptable-use', title: 'Допустимое использование', body: ['Нельзя:'], items: [
      'пытаться повлиять на разбор — например, прятать в эссе инструкции для AI;',
      'отправлять эссе автоматически или массово, передавать аккаунт другим, обходить лимиты или меры защиты;',
      'получать доступ к чужим аккаунтам и данным, собирать данные сервиса автоматически или мешать его работе;',
      'отправлять незаконный или вредоносный контент, декомпилировать сервис или восстанавливать его исходный код, кроме случаев, прямо разрешённых законом.',
    ]},
    {id: 'privacy-deletion', title: 'Конфиденциальность и удаление', body: [
      'Политика конфиденциальности GoNative Exams объясняет, какие данные мы обрабатываем, в том числе что передаётся AI-провайдеру, и как воспользоваться своими правами.',
    ], items: [
      'Любое эссе можно удалить из истории. Удаление безвозвратно.',
      'В настройках можно удалить все данные Exams, сохранив аккаунт GoNative, или закрыть весь аккаунт GoNative — это затрагивает все продукты GoNative.',
    ], links: [{label: 'Политика конфиденциальности GoNative Exams', href: '/privacy'}]},
    {id: 'availability', title: 'Доступность и ограничения', items: [
      'Функции, экзамены, задания и лимиты могут меняться. Разбор может быть временно недоступен — например, из-за обслуживания или недоступности AI-провайдера.',
      'Вы можете перестать пользоваться Exams в любой момент. Мы можем ограничить или закрыть доступ при серьёзных или повторных нарушениях, злоупотреблении разбором, угрозах безопасности или требованиях закона. Когда это разумно, мы объясним причину и дадим возможность ответить.',
    ]},
    {id: 'liability', title: 'Ответственность и применимое право', body: [
      'В пределах, допустимых законом, Exams предоставляется «как есть» и «по мере доступности». Мы не отвечаем за косвенные убытки, за результаты экзаменов и за убытки из-за ошибок разбора, сторонних сервисов или событий вне нашего разумного контроля. Наша общая ответственность по претензиям, связанным с Exams, ограничена суммой, которую вы заплатили за Exams за предыдущие 12 месяцев. Это не ограничивает ответственность, которую закон ограничивать не позволяет, и ваши права потребителя.',
      'Применяется право Португалии. Потребители сохраняют защиту обязательных норм страны проживания и могут обращаться в её суды. Пожалуйста, сначала напишите нам — постараемся решить вопрос.',
    ]},
    {id: 'changes-contact', title: 'Изменения и контакты', body: [
      'Если условия изменятся, новая редакция появится здесь, и мы попросим принять её, прежде чем продолжить. Если вы не согласны, вы можете перестать пользоваться Exams и удалить свои данные.',
      'Для общего аккаунта и приложений GoNative действуют условия GoNative. По вопросам, касающимся Exams, приоритет у этих условий. При расхождении переводов приоритет у английской версии, если местный закон не требует иного.',
      `По вопросам об Exams и этих условиях пишите на ${SUPPORT_EMAIL}.`,
    ], links: [{label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}`}, {label: 'Условия использования GoNative', href: GONATIVE_TERMS}]},
  ],
};

const uk: LegalDocument = {
  title: 'Умови використання GoNative Exams',
  version: `Редакція ${TERMS_VERSION}`,
  intro: 'Ці умови стосуються GoNative Exams — сервісу для практики письмових завдань іспитів з автоматичним розбором.',
  summary: [
    'Розбір створюється автоматично й може містити помилки. Діапазони балів — орієнтовна оцінка для практики, а не офіційний результат.',
    'GoNative Exams не пов’язаний з IELTS та її власниками й не схвалений ними. Завдання для практики — наші власні, а не офіційні екзаменаційні.',
    'Ваші есе залишаються вашими. Надсилайте лише свої тексти й не намагайтеся вплинути на розбір.',
  ],
  sections: [
    {id: 'account', title: 'Сервіс і ваш акаунт', body: [
      `GoNative Exams керує фізична особа ${OPERATOR}, адреса: ${OPERATOR_ADDRESS}. Ці умови — угода між вами й оператором. Приймаючи їх під час першого входу або користуючись Exams, ви погоджуєтеся з ними.`,
    ], items: [
      'Exams працює зі спільним акаунтом GoNative: ті самі email і пароль, що в застосунку GoNative і Worksheets, або підтримуваний спосіб входу. У Exams свій профіль і свої сеанси.',
      'Вам має бути не менше 16 років, і ви повинні мати право прийняти ці умови.',
      'Зберігайте дані для входу в безпеці й повідомте нас, якщо підозрюєте чужий доступ.',
    ]},
    {id: 'feedback', title: 'Що таке розбір і чим він не є', items: [
      'Розбір створюється автоматично за допомогою AI-моделей, без перевірки людиною. Він може пропустити помилку, позначити правильне як проблему або неточно щось пояснити. Покладайтеся й на власне судження та скаржтеся на розбір, якщо вважаєте його неправильним.',
      'Діапазони балів — навмисно широка оцінка для практики. Це не офіційний результат, не прогноз вашого бала на іспиті й не висновок про готовність до нього.',
      'IELTS — зареєстрована торговельна марка її власників. GoNative Exams не пов’язаний із ними, не схвалений ними й не афілійований. Завдання для практики написані нами й не є офіційними екзаменаційними завданнями.',
      'Exams — інструмент підготовки й не гарантує жодного результату іспиту.',
    ]},
    {id: 'limits', title: 'Тарифи й ліміти', items: [
      'Чинні безкоштовні ліміти — наприклад, кількість розборів на місяць — показано в сервісі. Ми можемо їх змінювати й завжди показуємо поточні ліміти перед надсиланням.',
      'Розбір зараховується, коли есе прийнято на AI-розбір. Повторне надсилання точно того самого тексту повертає готовий розбір і не зараховується знову. Есе, які наші автоматичні перевірки оцінюють без AI (наприклад, дуже короткі тексти), не зараховуються.',
      'Платні тарифи, коли вони з’являться, буде описано в сервісі до купівлі.',
    ]},
    {id: 'content', title: 'Ваші есе й допустиме використання', items: [
      'Права на ваші есе й написані вами завдання залишаються за вами. Ви дозволяєте нам зберігати й обробляти їх, зокрема передавати нашому AI-провайдерові, щоб зберігати чернетки, робити розбір і показувати історію та прогрес.',
      'Ми не публікуємо ваші есе, не показуємо їх іншим користувачам і не використовуємо їх для навчання AI-моделей.',
      'Надсилайте лише тексти, які написали самі або маєте право використовувати. Не включайте в них персональні дані інших людей.',
      'Наші завдання для практики, пояснення, програмне забезпечення й дизайн належать нам або нашим ліцензіарам. Завдання й розбори можна використовувати для власного навчання; не можна масово копіювати їх, перепродавати або використовувати для створення конкурентного продукту й навчання AI-моделей.',
    ]},
    {id: 'acceptable-use', title: 'Допустиме використання', body: ['Не можна:'], items: [
      'намагатися вплинути на розбір — наприклад, ховати в есе інструкції для AI;',
      'надсилати есе автоматично або масово, передавати акаунт іншим, обходити ліміти чи заходи захисту;',
      'отримувати доступ до чужих акаунтів і даних, збирати дані сервісу автоматично або заважати його роботі;',
      'надсилати незаконний або шкідливий контент, декомпілювати сервіс чи відновлювати його вихідний код, крім випадків, прямо дозволених законом.',
    ]},
    {id: 'privacy-deletion', title: 'Конфіденційність і видалення', body: [
      'Політика конфіденційності GoNative Exams пояснює, які дані ми обробляємо, зокрема що передається AI-провайдерові, і як скористатися своїми правами.',
    ], items: [
      'Будь-яке есе можна видалити з історії. Видалення безповоротне.',
      'У налаштуваннях можна видалити всі дані Exams, зберігши акаунт GoNative, або закрити весь акаунт GoNative — це зачіпає всі продукти GoNative.',
    ], links: [{label: 'Політика конфіденційності GoNative Exams', href: '/privacy'}]},
    {id: 'availability', title: 'Доступність і обмеження', items: [
      'Функції, іспити, завдання й ліміти можуть змінюватися. Розбір може бути тимчасово недоступний — наприклад, через обслуговування або недоступність AI-провайдера.',
      'Ви можете припинити користуватися Exams будь-коли. Ми можемо обмежити або закрити доступ у разі серйозних чи повторних порушень, зловживання розбором, загроз безпеці або вимог закону. Коли це розумно, ми пояснимо причину й дамо можливість відповісти.',
    ]},
    {id: 'liability', title: 'Відповідальність і застосовне право', body: [
      'У межах, дозволених законом, Exams надається «як є» й «у міру доступності». Ми не відповідаємо за непрямі збитки, за результати іспитів і за збитки через помилки розбору, сторонні сервіси або події поза нашим розумним контролем. Наша загальна відповідальність за претензіями, пов’язаними з Exams, обмежена сумою, яку ви заплатили за Exams за попередні 12 місяців. Це не обмежує відповідальність, яку закон обмежувати не дозволяє, і ваші права споживача.',
      'Застосовується право Португалії. Споживачі зберігають захист обов’язкових норм країни проживання й можуть звертатися до її судів. Будь ласка, спочатку напишіть нам — постараємося вирішити питання.',
    ]},
    {id: 'changes-contact', title: 'Зміни й контакти', body: [
      'Якщо умови зміняться, нова редакція з’явиться тут, і ми попросимо прийняти її, перш ніж продовжити. Якщо ви не згодні, ви можете припинити користуватися Exams і видалити свої дані.',
      'Для спільного акаунта й застосунків GoNative діють умови GoNative. З питань, що стосуються Exams, пріоритет мають ці умови. У разі розбіжності перекладів пріоритет має англійська версія, якщо місцевий закон не вимагає іншого.',
      `З питань щодо Exams і цих умов пишіть на ${SUPPORT_EMAIL}.`,
    ], links: [{label: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}`}, {label: 'Умови використання GoNative', href: GONATIVE_TERMS}]},
  ],
};

export const terms = {en, ru, uk} as const;
