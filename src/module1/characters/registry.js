import { readFile } from "node:fs/promises";
import path from "node:path";

export async function resolveCharacter(config) {
  if (config.character) {
    validateCharacter(config.character);
    return config.character;
  }

  if (!config.character_id) {
    throw new Error("Config must include character_id or inline character");
  }

  const registryDir = config.character_registry_dir || "data/characters";
  const characterPath = path.join(registryDir, `${config.character_id}.json`);
  const character = JSON.parse(await readFile(characterPath, "utf8"));
  validateCharacter(character);
  return character;
}

export function validateCharacter(character) {
  if (!character.id) throw new Error("Character is missing id");
  if (!Array.isArray(character.reference_images)) {
    throw new Error(`Character ${character.id} must include reference_images array`);
  }
  if (!character.kling_element_id && character.reference_images.length === 0) {
    throw new Error(`Character ${character.id} needs kling_element_id or reference_images`);
  }
}
