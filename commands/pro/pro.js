function fixEscapes(str) {
  return str.replace(/[^a-z0-9|]/ig, '\\$&');
}

let proLangRe;
let pros;

function updateProsMatcher() {
  /* eslint global-require: off */
  delete require.cache[require.resolve('./proTerms.js')];
  pros = {};

  const terms = require('./proTerms.js')
    .filter(termList => termList[0].length > 0)
    .map((termList) => {
      const termPros = new Set();
      termPros.original = termList[0];

      termList.forEach((term) => {
        pros[term.toLowerCase()] = termPros;
      });

      return fixEscapes(termList.join('|'));
    });

  proLangRe = new RegExp(`(?:^|\\W)(${terms.join('|')})(?:$|\\W)`, 'gi');
}


function getProsOnline(guild) {
  return new Set(guild.members
    .filter(m => m.roles.find('name', 'Pros') && ['online', 'idle'].includes(m.presence.status))
    .map(p => p.user.username));
}


function loadAndMatchPros(bot) {
  updateProsMatcher();
  const helpChannel = bot.client.channels.find('name', 'helpdirectory');

  return helpChannel.fetchMessages({ limit: 100 })
  .then((messages) => {
    messages.forEach((messageObj) => {
      proLangRe.lastIndex = 0;
      while (true) {
        const match = proLangRe.exec(messageObj.content);
        if (!match) {
          break;
        }
        pros[match[1].toLowerCase()].add(messageObj.author.username);
      }
    });
  });
}


function getPros(bot, lang) {
  if (!pros[lang]) {
    return null;
  }
  const langPros = Array.from(pros[lang]);
  const guild = bot.client.guilds.first();
  const online = getProsOnline(guild);
  return langPros.filter(user => online.has(user)).join('\n');
}

module.exports = {
  usage: [
    'please gimme a topic, will\'ya?',
    'pro <topic> - list of people who knows about <topic>',
    'pro reset - reload all the pro data (mod only)',
  ],

  run(bot, message, cmdArgs) {
    if (!cmdArgs) {
      return true;
    }

    let lang = cmdArgs.toLowerCase().trim();

    if (lang === 'reset' && bot.isAdminOrMod(message.member)) {
      loadAndMatchPros(bot).then(() => {
        message.channel.sendMessage('Pros list refreshed.');
        return false;
      })
      .catch((err) => {
        console.error(err);
        console.error(err.stack);
      });
      return false;
    }

    proLangRe.lastIndex = 0;
    const match = proLangRe.exec(lang);
    lang = ((match && match[1]) || lang).toLowerCase();

    const foundPros = getPros(bot, lang);
    message.channel.sendMessage(foundPros ?
      `Here are some pros online that can help with **${pros[lang].original}**: \n${foundPros}` :
      `No pros found for ${cmdArgs} :(`);
    return false;
  },

  init(bot) {
    console.log('Loading pros...');
    loadAndMatchPros(bot)
      .then(() => {
        console.log('Done reading in pros from #helpdirectory!');
      })
      .catch((err) => {
        console.error(err);
        console.error(err.stack);
      });
  },
};

