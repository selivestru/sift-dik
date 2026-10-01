import { CHARACTERS } from '../constants/characters'
import { SPELL_TYPES } from '../types/spells.types'
import type { Locale } from './types'

export const en: Locale = {
  cards: {
    [CHARACTERS.TREMOLO]: {
      name: 'Tremolo',
      description:
        '{summon}: Choose a path — {dik_path}: Give me +1|+0 and {quick_attack}. ' +
        '{neutral_path}: Reduce my attack by 1, give me {elusive} and restore 1 {reserved_energy}. ' +
        '{chick_path}: Give me {tough} and {support} ({support}: Give the supported ally +1|+1 this round).',
    },
    [SPELL_TYPES.PREEMPTIVE_STRIKE]: {
      name: 'Preemptive Strike',
      description: 'Give an ally +2|+1 and {quick_attack} this round.',
    },
    [SPELL_TYPES.TEMP_STUN]: {
      name: 'Stun',
      description: 'Stun an enemy this round. {stunned}',
    },
    [SPELL_TYPES.TEMP_BURST]: {
      name: 'Burst of Energy',
      description: 'Give an ally +1|+0 this round.',
    },
    [SPELL_TYPES.TEMP_SLOW]: {
      name: 'Pep Talk',
      description: 'Give an ally +1|+1.',
    },
  },
  terms: {
    summon: {
      name: 'Play',
      rules: 'Triggers when you play this card from hand.',
    },
    reputation: {
      name: 'Reputation',
      rules: 'Your life total. Reaching 0 means social defeat.',
    },
    initiative: {
      name: 'Initiative',
      rules: 'The right to declare attacks this round.',
    },
    reserved_energy: {
      name: 'Reserved Energy',
      rules: 'Unspent energy, capped at 3. Spent on Events first.',
    },
    dik_path: {
      name: 'DIK',
      rules: 'The DIK frat path. Strength and momentum.',
    },
    neutral_path: {
      name: 'Neutral',
      rules: 'The neutral path. Caution and cunning.',
    },
    chick_path: {
      name: 'CHICK',
      rules: 'The CHICK path. Protection and supporting allies.',
    },
    support: {
      name: 'Support',
      rules: 'When attacking, give the ally to the right +1|+1 this round.',
    },
    quick_attack: {
      name: 'Quick Attack',
      rules: 'Strikes first when attacking.',
    },
    double_attack: {
      name: 'Double Attack',
      rules: 'Strikes first when attacking, then strikes again simultaneously with the blocker.',
    },
    lifesteal: {
      name: 'Lifesteal',
      rules: 'Heals your player Reputation by the amount of damage dealt.',
    },
    regeneration: {
      name: 'Regeneration',
      rules: 'Fully restores health at the end of each round.',
    },
    tough: {
      name: 'Tough',
      rules: 'Reduces all incoming damage by 1.',
    },
    overwhelm: {
      name: 'Overwhelm',
      rules:
        "Excess damage beyond the blocker's lethal threshold carries over to the defending player's Reputation.",
    },
    cannot_attack: {
      name: 'Cannot Attack',
      rules: 'Cannot be declared as an attacker.',
    },
    cannot_block: {
      name: 'Cannot Block',
      rules: 'Cannot be declared as a blocker.',
    },
    impulse: {
      name: 'Impulse',
      rules: 'On summon, restores 1 Reserved Energy.',
    },
    elusive: {
      name: 'Elusive',
      rules: 'Can only be blocked by a unit with Elusive.',
    },
    fury: {
      name: 'Fury',
      rules: 'Permanently gains +1|+1 upon killing an opposing combatant.',
    },
    ram: {
      name: 'Ram',
      rules: 'Deals 1 damage to the enemy Reputation upon striking.',
    },
    fleeting: {
      name: 'Fleeting',
      rules: 'Discarded to the graveyard at the end of the round.',
    },
    ephemeral: {
      name: 'Ephemeral',
      rules: 'Dies immediately after striking in combat or at round end.',
    },
    invulnerable: {
      name: 'Invulnerable',
      rules: 'Immune to all combat damage.',
    },
    pressure: {
      name: 'Pressure',
      rules: 'Can only be blocked by a unit with 3 or more attack.',
    },
    barrier: {
      name: 'Barrier',
      rules: 'Negates the next incoming damage greater than 0 and is consumed.',
    },
    stunned: {
      name: 'Stun',
      rules: "A stunned unit is removed from combat and can't attack or block this round.",
    },
  },
}
