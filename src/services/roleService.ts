/**
 * Role Service
 * 
 * Manages role assignments for highest/lowest ELO players
 */

import { Guild, Role, Snowflake } from 'discord.js';
import { getLogger } from '../utils/logger';
import { RoleAssignment } from '../types';
import {
  getHighestEloPlayers,
  getLowestEloPlayers,
} from '../database/playerRepository';

/**
 * Get current role assignment data
 */
export function getRoleAssignmentData(): RoleAssignment {
  const highest = getHighestEloPlayers();
  const lowest = getLowestEloPlayers();

  return {
    highestEloPlayers: highest.map((p) => ({
      discordId: p.discordId,
      username: p.username,
      elo: p.elo,
    })),
    lowestEloPlayers: lowest.map((p) => ({
      discordId: p.discordId,
      username: p.username,
      elo: p.elo,
    })),
  };
}

/**
 * Update roles in a guild
 */
export async function updateRoles(
  guild: Guild,
  highestEloRoleId: Snowflake,
  lowestEloRoleId: Snowflake
): Promise<{
  success: boolean;
  highestAssigned: string[];
  lowestAssigned: string[];
  errors: string[];
}> {
  const logger = getLogger();
  const errors: string[] = [];
  let highestAssigned: string[] = [];
  let lowestAssigned: string[] = [];

  try {
    // Get roles
    const highestRole = await guild.roles.fetch(highestEloRoleId);
    const lowestRole = await guild.roles.fetch(lowestEloRoleId);

    if (!highestRole) {
      errors.push(`Highest ELO role not found: ${highestEloRoleId}`);
    }
    if (!lowestRole) {
      errors.push(`Lowest ELO role not found: ${lowestEloRoleId}`);
    }

    if (!highestRole && !lowestRole) {
      return { success: false, highestAssigned, lowestAssigned, errors };
    }

    // Get assignment data
    const assignment = getRoleAssignmentData();

    // Update highest ELO role
    if (highestRole) {
      const newOwnerIds = assignment.highestEloPlayers.map((p) => p.discordId);
      const result = await updateSingleRole(
        guild,
        highestRole,
        newOwnerIds,
        'highest'
      );
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
      highestAssigned = result.assignedTo;
    }

    // Update lowest ELO role
    if (lowestRole) {
      const newOwnerIds = assignment.lowestEloPlayers.map((p) => p.discordId);
      const result = await updateSingleRole(
        guild,
        lowestRole,
        newOwnerIds,
        'lowest'
      );
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
      lowestAssigned = result.assignedTo;
    }

    logger.info(`Role updates complete. Highest: ${highestAssigned.join(', ') || 'none'}, Lowest: ${lowestAssigned.join(', ') || 'none'}`);

    return {
      success: errors.length === 0,
      highestAssigned,
      lowestAssigned,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error updating roles: ${errorMessage}`);
    errors.push(errorMessage);
    return { success: false, highestAssigned, lowestAssigned, errors };
  }
}

/**
 * Update a single role assignment (supports multiple owners)
 */
async function updateSingleRole(
  guild: Guild,
  role: Role,
  newOwnerIds: Snowflake[],
  roleType: 'highest' | 'lowest'
): Promise<{ assignedTo: string[]; errors: string[] }> {
  const logger = getLogger();
  const assignedTo: string[] = [];
  const errors: string[] = [];

  try {
    // Get all members with this role
    const membersWithRole = role.members;
    const newOwnerIdSet = new Set(newOwnerIds);

    // Remove role from members who should no longer have it
    for (const [memberId, member] of membersWithRole) {
      if (!newOwnerIdSet.has(memberId)) {
        try {
          await member.roles.remove(role);
          logger.debug(`Removed ${roleType} ELO role from ${member.user.username}`);
        } catch (error) {
          logger.warn(`Could not remove role from ${member.user.username}: ${error}`);
        }
      }
    }

    // Assign to all new owners
    for (const newOwnerId of newOwnerIds) {
      try {
        const newOwner = await guild.members.fetch(newOwnerId);
        if (!newOwner.roles.cache.has(role.id)) {
          await newOwner.roles.add(role);
          logger.info(`Assigned ${roleType} ELO role to ${newOwner.user.username}`);
        }
        assignedTo.push(newOwner.user.username);
      } catch (error) {
        const errorMessage = `Could not assign ${roleType} role to ${newOwnerId}: ${error}`;
        logger.warn(errorMessage);
        errors.push(errorMessage);
      }
    }

    return { assignedTo, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { assignedTo, errors: [errorMessage] };
  }
}

/**
 * Check if bot has permission to manage roles
 */
export async function canManageRoles(
  guild: Guild,
  roleId: Snowflake
): Promise<boolean> {
  try {
    const botMember = await guild.members.fetch(guild.client.user!.id);
    const role = await guild.roles.fetch(roleId);

    if (!role) {
      return false;
    }

    // Check if bot has Manage Roles permission
    if (!botMember.permissions.has('ManageRoles')) {
      return false;
    }

    // Check if bot's highest role is above the target role
    return botMember.roles.highest.position > role.position;
  } catch {
    return false;
  }
}

export default {
  getRoleAssignmentData,
  updateRoles,
  canManageRoles,
};
