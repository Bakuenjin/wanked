/**
 * Role Service
 * 
 * Manages role assignments for highest/lowest ELO players
 */

import { Guild, Role, Snowflake } from 'discord.js';
import { getLogger } from '../utils/logger';
import { RoleAssignment } from '../types';
import {
  getHighestEloPlayer,
  getLowestEloPlayer,
} from '../database/playerRepository';

/**
 * Get current role assignment data
 */
export function getRoleAssignmentData(): RoleAssignment {
  const highest = getHighestEloPlayer();
  const lowest = getLowestEloPlayer();

  return {
    highestEloPlayer: highest
      ? {
          discordId: highest.discordId,
          username: highest.username,
          elo: highest.elo,
        }
      : null,
    lowestEloPlayer: lowest
      ? {
          discordId: lowest.discordId,
          username: lowest.username,
          elo: lowest.elo,
        }
      : null,
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
  highestAssigned: string | null;
  lowestAssigned: string | null;
  errors: string[];
}> {
  const logger = getLogger();
  const errors: string[] = [];
  let highestAssigned: string | null = null;
  let lowestAssigned: string | null = null;

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
      const result = await updateSingleRole(
        guild,
        highestRole,
        assignment.highestEloPlayer?.discordId ?? null,
        'highest'
      );
      if (result.error) {
        errors.push(result.error);
      }
      highestAssigned = result.assignedTo;
    }

    // Update lowest ELO role
    if (lowestRole) {
      const result = await updateSingleRole(
        guild,
        lowestRole,
        assignment.lowestEloPlayer?.discordId ?? null,
        'lowest'
      );
      if (result.error) {
        errors.push(result.error);
      }
      lowestAssigned = result.assignedTo;
    }

    logger.info(`Role updates complete. Highest: ${highestAssigned}, Lowest: ${lowestAssigned}`);

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
 * Update a single role assignment
 */
async function updateSingleRole(
  guild: Guild,
  role: Role,
  newOwnerId: Snowflake | null,
  roleType: 'highest' | 'lowest'
): Promise<{ assignedTo: string | null; error: string | null }> {
  const logger = getLogger();

  try {
    // Get all members with this role
    const membersWithRole = role.members;

    // Remove role from all current holders
    for (const [memberId, member] of membersWithRole) {
      if (memberId !== newOwnerId) {
        try {
          await member.roles.remove(role);
          logger.debug(`Removed ${roleType} ELO role from ${member.user.username}`);
        } catch (error) {
          logger.warn(`Could not remove role from ${member.user.username}: ${error}`);
        }
      }
    }

    // Assign to new owner
    if (newOwnerId) {
      try {
        const newOwner = await guild.members.fetch(newOwnerId);
        if (!newOwner.roles.cache.has(role.id)) {
          await newOwner.roles.add(role);
          logger.info(`Assigned ${roleType} ELO role to ${newOwner.user.username}`);
        }
        return { assignedTo: newOwner.user.username, error: null };
      } catch (error) {
        const errorMessage = `Could not assign ${roleType} role to ${newOwnerId}: ${error}`;
        logger.warn(errorMessage);
        return { assignedTo: null, error: errorMessage };
      }
    }

    return { assignedTo: null, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { assignedTo: null, error: errorMessage };
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
