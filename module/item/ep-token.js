import { getActorEntityById, getID, getOwnedItemsByType } from "../util.js";
import { getCrewForShip } from "../actor/crew.js";
/**
 * @param  {Actor} shipEntity
 */
export const createBlankEPToken = async (shipEntity) => {
  // oddly, foundry's data format maps to name and type being at the root object
  // and all other fields being shoveled into the data object.
  const tokenData = {
    name: "epk" + getID(),
    type: "energyPointToken",
    data: {
      active: false,
      holder: shipEntity.id,
    },
  };
  return await shipEntity.createOwnedItem(tokenData);
};

/**
 * returns all EP tokens regardless of active state or holder.
 * @param  {Actor} shipEntity
 */
const getEPTokens = (shipEntity) => {
  return getOwnedItemsByType(shipEntity, "energyPointToken");
};

/**
 * Returns the active tokens on the ship, regardless of holder.
 * @param  {Actor} shipEntity
 */
const getActiveEPTokens = (shipEntity) => {
  const tokens = getEPTokens(shipEntity);
  return tokens.filter((t) => t.data.active === true) || [];
};

/**
 * Sets the active number of tokens for the ship. Side effect is all tokens that
 * are currently assigned to crew members are returned to the ship.
 * @param  {Actor} shipEntity
 * @param  {Number} activeCount
 */
export const setActiveEPTokens = async (shipEntity, activeCount) => {
  const allTokens = getEPTokens(shipEntity);
  // first turn of all tokens and set their holder to ship.
  const newActiveTokens = allTokens.map((at) => ({
    _id: at._id,
    data: {
      active: false,
      holder: shipEntity.id,
    },
  }));

  // activate a select amount of tokens.
  for (let i = 0; i < activeCount; ++i) {
    newActiveTokens[i].data.active = true;
  }
  await shipEntity.updateEmbeddedEntity("OwnedItem", newActiveTokens);
};

/**
 * @param  {Actor} shipEntity
 * @returns the amount of active EP tokens that are currently held by the ship.
 */
export const shipEPCount = (shipEntity) => {
  const activeTokens = getActiveEPTokens(shipEntity);
  return activeTokens.filter((a) => a.data.holder === shipEntity.id).length;
};

/**
 * @param  {Actor} shipEntity
 * @param  {String} crewId ID of crew
 * @returns the amount of active EP tokens that are currently held by this crew
 * member
 */
export const crewEPCount = (shipEntity, crewId) => {
  const activeTokens = getActiveEPTokens(shipEntity);
  return activeTokens.filter((a) => a.data.holder === crewId).length;
};

/**
 * Allocates any EP tokens the ship has to this crew member. If the amount
 * requested is higher than the amount available, this will just allocate
 * whatever is remaining to the crew member.
 * @param  {Actor} shipEntity
 * @param  {String} crewId
 * @param  {Number} count
 */
export const setCrewEPCount = async (shipEntity, crewId, count) => {
  // first take any tokens owned by this crew member and return them to the
  // ship.
  const activeTokens = getActiveEPTokens(shipEntity);
  const updateData = activeTokens.map((at) => ({
    _id: at._id,
    data: {
      holder: at.data.holder === crewId ? shipEntity.id : at.data.holder,
    },
  }));
  // move count amount of tokens from ship to crewId but if it's higher than
  // available, just move what's available.
  const shipTokens = updateData.filter(
    (ud) => ud.data.holder === shipEntity.id
  );
  const allowedCount = Math.min(count, shipTokens.length);
  for (let i = 0; i < allowedCount; i++) {
    shipTokens[i].data.holder = crewId;
  }
  await shipEntity.updateEmbeddedEntity("OwnedItem", updateData);
};

/**
 * @param  {Actor} shipEntity
 * @returns true/false if any crew are currently holding tokens
 */
export const crewHasTokens = (shipEntity) => {
  const activeTokens = getActiveEPTokens(shipEntity);
  return activeTokens.filter((a) => a.data.holder !== shipEntity.id).length > 0;
};
/**
 * returns the maximum allowed EP Tokens a user or ship can hold.
 */
export const getMaxAllowedEPTokens = () => {
  return game.settings.get("yzecoriolis", "maxEPTokensAllowed");
};

/**
 * only GMs and users who are controlling an engineer on the ship can change EP
 * on a ship.
 * @param  {Actor} shipEntity
 * @returns true/false if local user can change EP on a ship sheet.
 */
export const canChangeEPForShip = (shipEntity) => {
  if (game.user.isGM) {
    return true;
  }
  const crewArray = getCrewForShip(shipEntity.id);
  const engineers = crewArray.filter(
    (c) => c.data.bio.crewPosition.position === "engineer"
  );

  for (let e of engineers) {
    const entity = getActorEntityById(e._id);
    if (entity?.permission === CONST.ENTITY_PERMISSIONS.OWNER) {
      return true;
    }
  }
  return false;
};