import fs from "fs";
import path from "path";

export const readJson = function <T>(file: string): T {
  if (!fs.existsSync(file)) {
    throw new Error(`file does not exists: ${file}`);
  }

  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
};

export const saveToJson = function <T>(file: string, data: T) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};
