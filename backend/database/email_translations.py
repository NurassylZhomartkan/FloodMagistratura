# backend/database/email_translations.py
# Словари переводов для email сообщений

EMAIL_TRANSLATIONS = {
    'ru': {
        'verification': {
            'subject': 'Подтверждение регистрации',
            'greeting': 'Здравствуйте, {username}!',
            'body_text': 'Спасибо за регистрацию. Пожалуйста, подтвердите ваш email, перейдя по ссылке:\n{verification_url}\n\nЕсли вы не регистрировались, проигнорируйте это письмо.',
            'body_html_title': 'Подтвердите ваш email',
            'body_html_message': 'Чтобы использовать FloodSite, нажмите на кнопку подтверждения.',
            'body_html_reason': 'Это поможет защитить ваш аккаунт.',
            'button_text': 'Подтвердить аккаунт',
            'link_text': 'Или скопируйте и вставьте эту ссылку в браузер:',
            'footer_text': 'Вы получили это письмо, потому что у вас есть аккаунт в FloodSite. Если вы не уверены, почему вы получили это письмо, пожалуйста, свяжитесь с нами, ответив на это письмо.',
            'ignore_text': 'Если вы не регистрировались, проигнорируйте это письмо.'
        },
        'password_reset': {
            'subject': 'Восстановление пароля',
            'greeting': 'Здравствуйте, {username}!',
            'body_text': 'Вы запросили восстановление пароля. Перейдите по ссылке ниже, чтобы установить новый пароль:\n{reset_url}\n\nСсылка действительна в течение 1 часа.\n\nЕсли вы не запрашивали восстановление пароля, проигнорируйте это письмо.',
            'body_html_title': 'Восстановление пароля',
            'body_html_message': 'Вы запросили восстановление пароля. Нажмите на кнопку ниже, чтобы установить новый пароль:',
            'button_text': 'Восстановить пароль',
            'link_text': 'Или скопируйте и вставьте эту ссылку в браузер:',
            'warning': 'Ссылка действительна в течение 1 часа.',
            'ignore_text': 'Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.'
        },
        'email_change_code': {
            'subject': 'Код подтверждения изменения email',
            'greeting': 'Здравствуйте, {username}!',
            'body_text': 'Вы запросили изменение email адреса. Ваш код подтверждения:\n{code}\n\nКод действителен в течение 15 минут.\n\nЕсли вы не запрашивали изменение email, проигнорируйте это письмо.',
            'body_html_title': 'Код подтверждения изменения email',
            'body_html_message': 'Вы запросили изменение email адреса.',
            'body_html_instruction': 'Используйте следующий код подтверждения:',
            'warning': 'Код действителен в течение 15 минут.',
            'footer_text': 'Вы получили это письмо, потому что был запрошен сброс email в вашем аккаунте FloodSite. Если вы не запрашивали изменение email, проигнорируйте это письмо.',
            'ignore_text': 'Если вы не запрашивали изменение email, проигнорируйте это письмо.'
        }
    },
    'en': {
        'verification': {
            'subject': 'Registration Confirmation',
            'greeting': 'Hello, {username}!',
            'body_text': 'Thank you for registering. Please confirm your email by clicking the link:\n{verification_url}\n\nIf you did not register, please ignore this email.',
            'body_html_title': 'Please verify your email',
            'body_html_message': 'To use FloodSite, click the verification button.',
            'body_html_reason': 'This helps keep your account secure.',
            'button_text': 'Verify my account',
            'link_text': 'Or copy and paste this link into your browser:',
            'footer_text': "You're receiving this email because you have an account in FloodSite. If you are not sure why you're receiving this, please contact us by replying to this email.",
            'ignore_text': 'If you did not register, please ignore this email.'
        },
        'password_reset': {
            'subject': 'Password Recovery',
            'greeting': 'Hello, {username}!',
            'body_text': 'You have requested a password reset. Click the link below to set a new password:\n{reset_url}\n\nThe link is valid for 1 hour.\n\nIf you did not request a password reset, please ignore this email.',
            'body_html_title': 'Password Recovery',
            'body_html_message': 'You have requested a password reset. Click the button below to set a new password:',
            'button_text': 'Reset password',
            'link_text': 'Or copy and paste this link into your browser:',
            'warning': 'The link is valid for 1 hour.',
            'ignore_text': 'If you did not request a password reset, please ignore this email.'
        },
        'email_change_code': {
            'subject': 'Email Change Confirmation Code',
            'greeting': 'Hello, {username}!',
            'body_text': 'You have requested to change your email address. Your confirmation code:\n{code}\n\nThe code is valid for 15 minutes.\n\nIf you did not request an email change, please ignore this email.',
            'body_html_title': 'Email Change Confirmation Code',
            'body_html_message': 'You have requested to change your email address.',
            'body_html_instruction': 'Use the following confirmation code:',
            'warning': 'The code is valid for 15 minutes.',
            'footer_text': "You're receiving this email because an email change was requested for your FloodSite account. If you did not request an email change, please ignore this email.",
            'ignore_text': 'If you did not request an email change, please ignore this email.'
        }
    },
    'kz': {
        'verification': {
            'subject': 'Тіркелуді растау',
            'greeting': 'Сәлем, {username}!',
            'body_text': 'Тіркелгеніңізге рахмет. Электрондық поштаңызды растау үшін мына сілтемені басыңыз:\n{verification_url}\n\nЕгер сіз тіркелмеген болсаңыз, осы хатты елемеңіз.',
            'body_html_title': 'Электрондық поштаңызды растаңыз',
            'body_html_message': 'FloodSite пайдалану үшін растау батырмасын басыңыз.',
            'body_html_reason': 'Бұл сіздің аккаунтыңызды қорғауға көмектеседі.',
            'button_text': 'Аккаунтымды растау',
            'link_text': 'Немесе мына сілтемені көшіріп, браузерге қойыңыз:',
            'footer_text': 'Сіз бұл хатты FloodSite-те аккаунтыңыз болғандықтан аласыз. Егер сіз бұл хатты неге алғаныңызға сенімсіз болсаңыз, осы хатқа жауап беру арқылы бізбен байланысыңыз.',
            'ignore_text': 'Егер сіз тіркелмеген болсаңыз, осы хатты елемеңіз.'
        },
        'password_reset': {
            'subject': 'Құпия сөзді қалпына келтіру',
            'greeting': 'Сәлем, {username}!',
            'body_text': 'Сіз құпия сөзді қалпына келтіруді сұрадыңыз. Жаңа құпия сөзді орнату үшін мына сілтемені басыңыз:\n{reset_url}\n\nСілтеме 1 сағатқа жарамды.\n\nЕгер сіз құпия сөзді қалпына келтіруді сұрамаған болсаңыз, осы хатты елемеңіз.',
            'body_html_title': 'Құпия сөзді қалпына келтіру',
            'body_html_message': 'Сіз құпия сөзді қалпына келтіруді сұрадыңыз. Жаңа құпия сөзді орнату үшін төмендегі батырманы басыңыз:',
            'button_text': 'Құпия сөзді қалпына келтіру',
            'link_text': 'Немесе мына сілтемені көшіріп, браузерге қойыңыз:',
            'warning': 'Сілтеме 1 сағатқа жарамды.',
            'ignore_text': 'Егер сіз құпия сөзді қалпына келтіруді сұрамаған болсаңыз, осы хатты елемеңіз.'
        },
        'email_change_code': {
            'subject': 'Электрондық поштаны өзгертуді растау коды',
            'greeting': 'Сәлем, {username}!',
            'body_text': 'Сіз электрондық пошта мекенжайын өзгертуді сұрадыңыз. Сіздің растау кодыңыз:\n{code}\n\nКод 15 минутқа жарамды.\n\nЕгер сіз электрондық поштаны өзгертуді сұрамаған болсаңыз, осы хатты елемеңіз.',
            'body_html_title': 'Электрондық поштаны өзгертуді растау коды',
            'body_html_message': 'Сіз электрондық пошта мекенжайын өзгертуді сұрадыңыз.',
            'body_html_instruction': 'Мына растау кодын пайдаланыңыз:',
            'warning': 'Код 15 минутқа жарамды.',
            'footer_text': 'Сіз бұл хатты FloodSite аккаунтыңыз үшін электрондық поштаны өзгерту сұралғандықтан аласыз. Егер сіз электрондық поштаны өзгертуді сұрамаған болсаңыз, осы хатты елемеңіз.',
            'ignore_text': 'Егер сіз электрондық поштаны өзгертуді сұрамаған болсаңыз, осы хатты елемеңіз.'
        }
    }
}

def get_email_translation(lang: str, category: str) -> dict:
    """
    Возвращает словарь переводов для указанного языка и категории.
    Если язык не найден, возвращает русский вариант.
    Если категория не найдена, возвращает пустой словарь.
    """
    if lang not in EMAIL_TRANSLATIONS:
        lang = 'ru'
    
    lang_dict = EMAIL_TRANSLATIONS.get(lang, EMAIL_TRANSLATIONS['ru'])
    return lang_dict.get(category, EMAIL_TRANSLATIONS['ru'].get(category, {}))

