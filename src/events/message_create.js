/**
 * Reborn - The core control of the only truly free and fair discord server.
 * Copyright (C) 2019  John Boyer
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
"use strict";
const catch_discord = require("../utilities/catch_discord.js");
const client = require("../services/client.js");
const {CommandError, Context} = require("patron.js");
const {config, constants: {discord_err_codes}} = require("../services/data.js");
const discord = require("../utilities/discord.js");
const handler = require("../services/handler.js");
const log = require("../utilities/logger.js");
const msg_collector = require("../services/message_collector.js");

function handle_err(result) {
  switch(result.error.code) {
    case discord_err_codes.no_bots:
      return "I don't have permission to do that.";
    case discord_err_codes.cant_dm:
      return "I can't DM you. Please allow direct messages from server members.";
    default:
      if(discord_err_codes.missing_perms.includes(result.error.code))
        return "I don't have permission to do that.";
      else if(result.error.code >= discord_err_codes.internal[0]
          && result.error.code <= discord_err_codes.internal[1])
        return "an unexpected error has occurred, please try again later.";
      else if(result.error.message.startsWith(discord_err_codes.timeout))
        return "Discord isn't responding, please try again later.";

      log.error(result.error);

      return result.error.message;
  }
}

async function handle_result(msg, result) {
  let reply = `**${discord.tag(msg.author)}**, `;

  switch(result.commandError) {
    case CommandError.Exception:
      reply += handle_err(result);
      break;
    case CommandError.BotPermission:
      if(result.permissions.includes("sendMessages") || result.permissions.includes("embedLinks"))
        return;

      reply += "I don't have permission to do that.";
      break;
    case CommandError.MemberPermission:
      reply += "you don't have permission to do that.";
      break;
    case CommandError.Cooldown:
      reply += "you're using this command too fast.";
      break;
    case CommandError.InvalidContext:
      reply += `this command may only be used in ${result.context === Context.Guild ? "DMs" : "a server"}.`;
      break;
    case CommandError.InvalidArgCount:
      reply += "you're incorrectly using this command.\n";
      reply += `**Usage:** \`${config.prefix}${result.command.getUsage()}\`\n`;
      reply += `**Example:** \`${config.prefix}${result.command.getExample()}\``;
      break;
    case CommandError.Command:
    case CommandError.Precondition:
    case CommandError.TypeReader:
      reply += result.errorReason;
      break;
    default:
      if(result.error === undefined) {
        log.error(result);
        reply += "an unknown error has occured.";
      }else{
        log.error(result.error);
        reply += result.error.message;
      }

      break;
  }

  await discord.create_msg(msg.channel, reply);
}

client.on("messageCreate", catch_discord(async msg => {
  msg_collector.check(msg);

  if(msg.embeds.length !== 0 || msg.author === undefined || msg.author.bot || !msg.content.startsWith(config.prefix))
    return;

  const result = await handler.run(msg, config.prefix.length);

  if(result.success || result.commandError === CommandError.UnknownCmd)
    return;

  await handle_result(msg, result);
}));
