import sqlite3 from 'sqlite3';
import { logger } from './index';
import { readFile } from 'fs/promises';

class AsyncStatement {
  constructor(private stmt: sqlite3.Statement) {}

  run(params: any[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.stmt.run(params, (err) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  async finalize() {
    return new Promise<void>((resolve, reject) =>
      this.stmt.finalize((err) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      })
    );
  }
}

class AsyncDatabase {
  private db: sqlite3.Database;

  constructor(filename) {
    this.db = new sqlite3.Database(filename);
  }

  async run(sql: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  async all(sql: string): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      this.db.all(sql, (err, rows) => {
        if (!err) {
          resolve(rows);
        } else {
          reject(err);
        }
      });
    });
  }

  prepare(sql: string): AsyncStatement {
    return new AsyncStatement(this.db.prepare(sql));
  }
}

export async function createDb(argv) {
  const db = new AsyncDatabase(argv.dbfile);
  const csvFile = argv['csv-file'];

  const fileContent = await readFile(csvFile, 'utf-8');
  const lines = fileContent.split('\n');
  const header = lines[0];
  const data = lines.splice(1);
  const columns = header.split(',');

  //await db.run(`DROP TABLE IF EXISTS stats`);
  await db.run(`CREATE TABLE IF NOT EXISTS stats (${header},grouping)`);

  const stmt = db.prepare(
    `INSERT INTO stats VALUES (${columns.map(() => '?').join(',')}, ?)`
  );
  await Promise.all(
    data.map((row) => {
      stmt.run([...row.split(','), '-']);
    })
  );
  await stmt.finalize();
  if (argv.aggregation) {
    const aggregation = argv.aggregation;
    const query = `SELECT DISTINCT folder FROM stats`;
    let folders: string[] = [];
    const rows = await db.all(query);

    folders = rows.map((row) => (row as { folder: string }).folder);

    const aggRegex = new RegExp(aggregation);
    const contentMap = folders
      .filter((folder) => !!folder)
      .map((folder) => {
        // Last part of folder is normally vmaf modelname (vmaf/4k), second last identifies the content
        // Example path: /some/folder/My-Program/HD
        const name = folder.split('/').slice(-2)[0];
        const res = aggRegex.exec(name);
        return {
          folder,
          grouping: res?.[1] || name
        };
      });
    const updateStmt = db.prepare(
      'UPDATE stats SET grouping = ? WHERE folder = ?'
    );
    await Promise.all(
      contentMap.map(({ folder, grouping }) =>
        updateStmt.run([grouping, folder])
      )
    );
  }
}

export interface LadderRungStats {
  rungNo: number;
  content: string;
  bitrate: number;
  vmaf: number;
  selectors: string;
}

export async function ladderStats(argv) {
  const db = new AsyncDatabase(argv.dbfile);

  const programs = (await db.all('SELECT DISTINCT grouping FROM stats')).map(
    (row) => (row as { grouping: string }).grouping
  );

  const rungs = argv.ladder.split(':').map((selectors) => {
    return selectors.split(',').map((columnValue) => {
      const [column, value] = columnValue.split('=');
      return { column, value };
    });
  });

  const allRungStats: Record<string, LadderRungStats[]> = {};
  for (let i = 0; i < rungs.length; i++) {
    const rungExpression = rungs[i];
    const rungWhere = rungExpression
      .map(({ column, value }) => `${column} like '${value}'`)
      .join(' AND ');
    const selectStatsSql = `SELECT grouping, AVG(bitrate), AVG(vmafHd) FROM stats WHERE ${rungWhere} GROUP BY grouping`;
    const rungStats = await db.all(selectStatsSql);
    rungStats.forEach((rs) => {
      const content = rs.grouping;
      const statsList = allRungStats[content] || [];
      statsList.push({
        rungNo: i,
        content: content,
        bitrate: rs['AVG(bitrate)'] as number,
        vmaf: rs['AVG(vmafHd)'] as number,
        selectors: argv.ladder.split(':')[i].replaceAll(',', ':')
      });
      allRungStats[content] = statsList;
    });
  }

  console.log('content,rung,selectors,vmaf,bitrate (kbit/s)');
  for (const content of Object.keys(allRungStats)) {
    const rungStats = allRungStats[content];
    rungStats.forEach((rungStats) => {
      console.log(
        `${rungStats.content},${rungStats.rungNo},${rungStats.selectors},${rungStats.vmaf.toFixed(1)},${Math.round(rungStats.bitrate / 1000)}`
      );
    });
    console.log();
  }

  //console.log(contentMap);

  /*
  db.serialize(function () {
    db.run(
      `CREATE TABLE stats (${header},grouping)`,
      logError
    );
    const stmt = db.prepare(`INSERT INTO stats VALUES (${columns.map(() => '?').join(',')}, ?)`);
    data.forEach((row) => {
      stmt.run([...row.split(','), '-'], logError);
    });
    if (argv.aggregation) {
      const aggregation = argv.aggregation;
      const query = `SELECT DISTINCT folder FROM stats`;
      let folders: string[] = [];
      db.all(query, function(err, rows) {
        folders = rows.map(row => (row as {folder: string}).folder);

        const aggRegex = new RegExp(aggregation);
        const contentMap = folders.map(folder => {
          const res = aggRegex.exec(folder);
          console.log(res);
          return {
            folder,
            grouping: res?.[1] || folder
          }
        });
        console.log(contentMap);
      });

    }
  });

   */
}
