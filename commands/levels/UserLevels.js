const UserLevel = require('../../Models/UserLevel');

class UserLevels {

	/**
	 * Содержит true - если пользователь был найден в базе
	 * @type {Boolean}
	 */
	finded = false;

	/**
	 * Массив уровней
	 * @type {Array}
	 */
	#roles = [];

	/**
	 * Массив ID ролей уровней. Используется для поиска.
	 * @type {Array}
	 */
	#rolesIDs = [];

	/**
	 * Содержит объект примитивных данных пользователя
	 * @type {Object}
	 */
	#primitiveData = {};

	/**
	 * Содержит объект продвинутых данных пользователя
	 * @type {Object}
	 */
	#advancedData = {};

	/**
	 * Содержит эмбед данных
	 * @type {MessageEmbed}
	 */
	#embed = undefined;

	/**
	 * Получение пользователя из БД.
	 * @param {GuildMember} member
	 * @param {Object[]} roles Массив уровней
	 * @param {string[]} rolesIDs Массив ID ролей уровней.
	 * @param {boolean} [create=false] Если true - пользователь будет создан в
	 *   базе, если не будет найден
	 * @return {Promise} Объект пользователя
	 */
	constructor (member, roles, rolesIDs, create) {

		this.member = member;
		this.#roles = roles;
		this.#rolesIDs = rolesIDs;

		return new Promise(async resolve => {

			/** @type {UserLevel} */
			const user = await UserLevel.findByPk(this.member.id);

			if (user) {
				this.finded = true;
				this.#primitiveData = {
					messagesLegit: user.messagesLegit,
					messagesAll: user.messagesAll,
					activity: user.activity,
					symbols: user.symbols,
					last: user.last
				};
			} else if (create) {
				await UserLevel.create({ id: this.member.id });
				this.#primitiveData = {
					messagesLegit: 0,
					messagesAll: 0,
					activity: 1,
					symbols: 0,
					last: 0
				};
			}

			resolve(this);
		});

	};

	/**
	 * Обновляет данные пользователя в базе данных
	 */
	update () {
		UserLevel.update({
			messagesAll: this.#primitiveData.messagesAll,
			messagesLegit: this.#primitiveData.messagesLegit,
			symbols: this.#primitiveData.symbols,
			last: this.#primitiveData.last
		}, {
			where: {
				id: this.member.id
			}
		}).then(r => {});

		return this;
	};

	/**
	 * Регистрирует новое сообщение пользователя.
	 * После регистрации обновляются примитивные данные, но продвинутые теряют
	 * свою актуальность, потому очищаются.
	 * @param {Message} msg Сообщение пользователя
	 */
	userMessageCounting (msg) {
		const timestamp = Math.floor(msg.createdTimestamp / 1000);

		this.#primitiveData.messagesAll += 1;
		this.#primitiveData.symbols += msg.content.length;

		if (this.#primitiveData.last + 60 <= timestamp) {
			this.#primitiveData.last = timestamp;
			this.#primitiveData.messagesLegit += 1;
		}

		this.#advancedData = {};
		this.#embed = undefined;

		return this;
	};

	/**
	 * Обновляет роль пользователя в дискорде, если требуется
	 */
	updateRole () {
		if (this.member.id === '256114365894230018') return;

		const role = this.getRole();

		if (this.member.roles.cache.has(role.id)) return;

		if (role.id !== '648762974277992448') {
			this.member.roles.add(role.cache, 'По причине изменения уровня');
		}

		this.member.roles.cache
			.filter(r => this.#rolesIDs.includes(r.id))
			.each(r => {
				if (r.id !== role.id) {
					this.member.roles.remove(r, 'По причине изменения уровня');
				}
			});

		return this;
	};


	/**
	 * ***************************************************************************
	 * Функции возвращения примитивных данных
	 * ***************************************************************************
	 */

	/**
	 * Возвращает количество всех сообщений пользователя
	 * @return {Number}
	 */
	getMessagesAll () {
		return this.#primitiveData.messagesAll;
	};

	/**
	 * Возвращает количество только засчитанных сообщений пользователя
	 * @return {Number}
	 */
	getMessagesLegit () {
		return this.#primitiveData.messagesLegit;
	};

	/**
	 * Возвращает количество старых сообщений пользователя, которые не учувствуют
	 * в подсчёте
	 * @return {Number}
	 */
	getMessagesOld () {
		return this.#primitiveData.messagesOld;
	};

	/**
	 * Возвращает количество всех символов пользователя
	 * @return {Number}
	 */
	getSymbols () {
		return this.#primitiveData.symbols;
	};

	/**
	 * Возвращает количество активных дней пользователя за последние 30 суток
	 * @return {Number}
	 */
	getActivity () {
		return this.#primitiveData.activity;
	};


	/**
	 * ***************************************************************************
	 * Функции возвращения продвинутых данных
	 * ***************************************************************************
	 */

	/**
	 * Возвращает процент оверпоста
	 * @return {Number}
	 */
	getOverpost () {
		if (this.#advancedData.overpost) return this.#advancedData.overpost;

		const messagesAll = this.getMessagesAll();
		const messagesLegit = this.getMessagesLegit();

		const overpost = Math.round(
			(messagesAll - messagesLegit) / messagesLegit * 1000
		) / 10;

		return this.#advancedData.overpost = isNaN(overpost) ? 0 : overpost;
	};

	/**
	 * Возвращает среднее количество символов в сообщениях
	 * @return {Number}
	 */
	getSymbolsAvg () {
		if (this.#advancedData.symbolsAvg) return this.#advancedData.symbolsAvg;

		const messagesAll = this.getMessagesAll();
		const symbols = this.getSymbols();

		const symbolsAvg = Math.round((symbols / messagesAll) * 10) / 10;

		return this.#advancedData.symbolsAvg = isNaN(symbolsAvg) ? 0 : symbolsAvg;
	};

	/**
	 * Возвращает процент активности
	 * @return {Number}
	 */
	getActivityPer () {
		if (this.#advancedData.activityPer) return this.#advancedData.activityPer;

		const activity = this.getActivity();

		return this.#advancedData.activityPer = Math.round(activity / 30 * 1000) /
			10;
	};

	/**
	 * Возвращает опыт
	 * @return {Number}
	 */
	getExp () {
		if (this.#advancedData.exp) return this.#advancedData.exp;

		const messagesLegit = this.getMessagesLegit();
		const symbolsAvg = this.getSymbolsAvg();
		const activityPer = this.getActivityPer();

		const exp = Math.round(messagesLegit * symbolsAvg / 100 * activityPer);

		return this.#advancedData.exp = isNaN(exp) ? 0 : exp;
	};

	/**
	 * Возвращает количество оштрафованного опыта пользователя
	 * @return {Number}
	 */
	getExpFine () {
		if (this.#advancedData.expFine) return this.#advancedData.expFine;

		const activityPer = this.getActivityPer();
		const exp = this.getExp();

		const expFine = Math.round(100 / activityPer * exp - exp);

		return this.#advancedData.expFine = isNaN(expFine) ? 0 : expFine;
	};

	/**
	 * Возвращает роль пользователя
	 * @return {Object}
	 */
	getRole () {
		if (this.#advancedData.role) return this.#advancedData.role;

		const exp = this.getExp();

		for (const role of this.#roles) {
			if (role.value <= exp) return this.#advancedData.role = role;
		}
	};

	/**
	 * Возвращает следующую роль пользователя. Возвращает true - если следующей
	 * роли нет
	 * @return {Object}
	 */
	getNextRole () {
		if (this.#advancedData.nextRole) return this.#advancedData.nextRole;

		const role = this.getRole();

		return this.#advancedData.nextRole = this.#roles[role.pos - 1] ?? true;
	};

	/**
	 * Возвращает прогресс до следующей роли. Возвращает true - если следующей
	 * роли нет
	 * @return {Number}
	 */
	getNextRoleProgress () {
		if (this.#advancedData.nextRoleProgress) return this.#advancedData.nextRoleProgress;

		const exp = this.getExp();
		const role = this.getRole();
		const nextRole = this.getNextRole();

		if (nextRole === true) return true;

		const nextRoleProgress = Math.round(
			((exp - role.value) / (nextRole.value - role.value)) * 1000
		) / 10;

		return this.#advancedData.nextRoleProgress = nextRoleProgress;
	};


	/**
	 * ***************************************************************************
	 * Функции возвращения эмбеда
	 * ***************************************************************************
	 */

	/**
	 * Генерирует эмбед с данными пользователя
	 * @return {MessageEmbed}
	 */
	getEmbed () {
		if (this.#embed) return this.#embed;

		this.#embed = new Discord.MessageEmbed();

		this.#embed.setTitle('Статистика пользователя');
		this.#embed.setThumbnail(this.member.user.avatarURL({ dynamic: true }));
		this.#embed.setDescription(this.member.toString());

		this.addMessages();
		this.addSymbols();
		this.addOverpost();
		this.addActivity();
		this.addExp();
		this.addNextRole();

		this.setColor();

		return this.#embed;
	};

	/**
	 * Добавляет к эмбеду статистику сообщений
	 */
	addMessages () {
		const messagesAll = this.getMessagesAll().toLocaleString();
		const messagesLegit = this.getMessagesLegit().toLocaleString();

		this.#embed.addField(
			'Cообщения:',
			messagesAll + ' (Из них учитываются: ' + messagesLegit + ')'
		);
	};

	/**
	 * Добавляет к эмбеду статистику символов
	 */
	addSymbols () {
		const symbols = this.getSymbols().toLocaleString();
		const symbolsAvg = this.getSymbolsAvg().toLocaleString();

		this.#embed.addField(
			'Cимволы:',
			symbols + ' (AVG ' + symbolsAvg + ')'
		);
	};

	/**
	 * Добавляет к эмбеду показатель оверпоста
	 */
	addOverpost () {
		const overpost = this.getOverpost();

		this.#embed.addField('Оверпост:', overpost + '%');
	};

	/**
	 * Добавляет к эмбеду показатель активности
	 */
	addActivity () {
		const activity = this.getActivity();
		const activityPer = this.getActivityPer();

		if (activityPer === 100) return;

		this.#embed.addField(
			'Активность за последние 30 дней:',
			activityPer + '% (' + activity + '/' + '30)'
		);
	};

	/**
	 * Добавляет к эмбеду количество опыта
	 */
	addExp () {
		const exp = this.getExp().toLocaleString();
		const activityPer = this.getActivityPer();
		const expFine = this.getExpFine();

		let text = exp;
		if (expFine) {
			text += ' (Вычтено из за неактивности: ' + expFine.toLocaleString() + ')';
		}

		this.#embed.addField('Опыт:', text, activityPer === 100);
	};

	/**
	 * Добавляет к эмбеду следующую роль и прогресс до неё, если есть
	 */
	addNextRole () {
		const role = this.getRole();
		const nextRole = this.getNextRole();
		const nextRoleProgress = this.getNextRoleProgress();

		let text = nextRole === true ? '🎉'
			: nextRole.cache.toString() + ' ' + nextRoleProgress + '%';

		this.#embed.addField('Прогресс:', role.cache.toString() + ' -> ' + text);
	};

	/**
	 * Устанавливает у эмбеда цвет текущей роли пользователя
	 */
	setColor () {
		const role = this.getRole();

		this.#embed.setColor(role.cache.color);
	};

}

module.exports = UserLevels;
