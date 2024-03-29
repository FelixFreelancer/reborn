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
const {config, queries} = require("./data.js");
const Database = require("better-sqlite3");
const path = require("path");
const str = require("../utilities/string.js");

module.exports = {
  load() {
    this.db = new Database(path.join(__dirname, "../", config.database));
    this.db.pragma("journal_mode = WAL");

    const list = Object.keys(queries);

    for(let i = 0; i < list.length; i++) {
      if(queries[list[i]].match(/{\d+}/))
        queries[list[i]] = queries[list[i]].replace(/[\s\r\n]+/g, " ");
      else
        queries[list[i]] = this.db.prepare(queries[list[i]].replace(/[\s\r\n]+/g, " "));

      if(list[i].includes("table"))
        queries[list[i]].run();
    }
  },

  fetch(table, columns) {
    const query = this.db.prepare(str.format(queries.select, table));
    const res = query.get(columns.guild_id);

    if(res !== undefined)
      return res;

    columns.created_at = Date.now();

    const keys = Object.keys(columns);

    this.db.prepare(str.format(
      queries.insert,
      table,
      keys.join(", "),
      keys.map(() => "?").join(", ")
    )).run(...Object.values(columns));

    return query.get(columns.guild_id);
  },

  update(table, changed) {
    changed.created_at = Date.now();
    changed.last_modified_at = Date.now();

    const columns = Object.keys(changed);
    const updates = [];

    for(let i = 0; i < columns.length; i++) {
      if(columns[i] === "guild_id" || columns[i] === "created_at")
        continue;

      updates.push(`${columns[i]}=excluded.${columns[i]}`);
    }

    this.db.prepare(str.format(
      queries.upsert,
      table,
      columns.join(", "),
      columns.map(() => "?").join(", "),
      updates.join(", ")
    )).run(...Object.values(changed));
  },

  fetch_pending_detainments() {
    return this.db.prepare(str.format(
      queries.select_pending_detainments,
      Math.floor(config.detain_time / 6e4),
      Math.floor(config.max_case_time / 6e4)
    )).all();
  },

  serve_detainment(id) {
    return queries.serve_detainment.run(id);
  },

  fled_detainment(id) {
    return queries.fled_detainment.run(id);
  },

  fetch_pending_cases() {
    return this.db.prepare(str.format(
      queries.select_pending_cases,
      Math.floor(config.max_case_time / 6e4)
    )).all();
  },

  close_case(id) {
    return queries.close_case.run(id);
  },

  get_channel_case(channel_id) {
    return queries.select_channel_case.get(channel_id);
  },

  fetch_laws(id) {
    return queries.select_laws.all(id);
  },

  fetch_warrants(id) {
    return queries.select_warrants.all(id);
  }
};
