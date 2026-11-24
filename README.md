# Weredragon: Reign of the Weredragon

A Foundry VTT module for running the **Reign of the Weredragon** campaign frame from *Daggerheart: Hope & Fear*. The whole table builds Forlorne Lykona together with the **Villain Builder** and receives the Astromancer's **Night Sky Reading**. The GM gets compendiums for the weredragon queen, her weredrakes, the two curses and the curse-breaking Keys to Victory.

## Requirements

- [**Foundry VTT**](https://foundryvtt.com/) v14
- [**Daggerheart**](https://foundryborne.online/) system 2.12 or later
- [**Daggerheart: Hope & Fear**](https://www.foundryvtt.store/products/daggerheart-hope-and-fear) module (`daggerheart-hope-and-fear`): provides the art (Forlorne, the weredrake, the Astromancer, Lady Lavender's Longsword, the Zoetrope) and the rulebook pages this module links to. This module doesn't include any of that art.
- Optional: [**Dice So Nice**](https://foundryvtt.com/packages/dice-so-nice) for 3D dice in both apps

This module conflicts with the other campaign frame modules (`dh-hotpot`, `dh-5banners`, `dh-horizon`). Run one campaign frame at a time.

## Installation

In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

```
https://github.com/emberite/dh-weredragon/releases/latest/download/module.json
```

## Features

Both apps are in the **Reign of the Weredragon** section of the Daggerheart sidebar menu. You can also open them with the macros `game.modules.get('dh-weredragon').api.openVillainBuilder()` and `game.modules.get('dh-weredragon').api.openNightSky()`. They are shared table apps: everyone sees the same state live. **Show to everyone** opens an app on every connected client. Players' changes go through the GM, so a GM needs to be connected.

### Villain Builder (session zero)

Build the weredragon queen together before character creation, from the 40 prompts of the book's Villain Builder.

1. **Setup (GM):** choose **Folded slips** (a number of prompts cut out and scattered on the table) or the **Roll table** (a d4 for tens and a d10 for ones, with used prompts rerolled automatically). Then choose how many prompts to use (15 by default) and who sits at the table, in turn order.
2. **At the table:** on their turn, a player picks a slip (or rolls), reads the prompt aloud and answers it. Anyone can ask a follow-up question, which the answering player can answer. The prompt can be **passed** to another player or **discarded**, in which case the same player draws again. *Ctrl+Enter* submits.
3. **What Whelvia knows:** every answer collects in the side panel. When the slips run out (or the target number is answered), the GM writes everything to the journal **Forlorne Lykona, as the Table Tells It**. The GM can edit answers, finish early or go back to the table.

### Night Sky Reading (Heaven's Eye)

The Astromancer's reading of the five revelations.

1. **Roll the stars:** the players collectively roll 5d6. Each player can roll a star, or roll all the remaining ones at once.
2. **Read the sky (GM):** click a lit cell of the Night Sky Reading table to place a die showing that number in that revelation's column. You can also drag a die onto a column, or use **Place the rest**. The chosen cells are joined into a constellation. The app warns when two revelations send the party to the same location ("spread out where the PCs have to go"). **Edit the table** replaces any entry with your own after session zero.
3. **Reveal:** the five revelations appear for everyone as cards with their rules. A chat card is posted and the journal **The Astromancer's Reading** is written.
   - **First revelation:** each player whispers a secret Forlorne is hiding. The secrets land on a GM-only journal page, for the GM to pick one between sessions.
   - **Second revelation:** the powerful ally's pool of 3 Hope, which players spend by clicking. The GM refills it for each new scene with Forlorne.
   - **Fifth revelation:** a checklist (secret, ally, both keys). With all four, Forlorne appears alone, without Feed on Fear and Terrifying.
   - The Keys to Victory link to their items: the system's SRD equipment, or this module's items for Lady Lavender's Longsword, the Zoetrope and the Stag Knight's Bramble Sword.

### Compendiums

Under **Reign of the Weredragon** in the compendium sidebar, behind the campaign frame's cover art:

- **Weredragon Adversaries:** Forlorne Lykona in her **Faun Form** and **Dragon Form** (Tier 4 Solo, sharing her framework of HP, Stress, Experiences, Relentless (4), Transform and Feed on Fear), and the **Weredrake** (Tier 1 Standard).
- **Weredragon Items:** Lady Lavender's Longsword (Tier 3), the Zoetrope of the Bright Bacchanal, and the Stag Knight's Bramble Sword (Advanced Cutlass statistics).
- **Weredragon Curses:** the **Weredrake Curse** and the **Petrified Curse** as features you can drop on a character or adversary.

### Curses and automation

- The two curses are also **status conditions** in the token HUD. Forlorne's **Breath Weapon** and **Stone-Cold Gaze** apply them through the system's effect buttons. The Petrified Curse also makes the target Restrained and Vulnerable and adds +10 to their damage thresholds.
- While cursed, a token takes the **weredrake's shape** or **turns the color of stone**. Clearing the curse restores it.
- Using **Curse Breaker** (Lady Lavender's Longsword) or **Light the Zoetrope** clears every curse on your targeted creatures and posts a chat message.
- Using Forlorne's **Transform** swaps her token between her Faun Form and Dragon Form. She keeps the HP and Stress she has marked and her conditions, and her token is resized around its center. The other form is imported from the compendium the first time it's needed.

Each automation can be turned off in the module settings.

## Development

The compendiums are built from `data/packs.mjs`:

```sh
npm install
npm run build   # writes src/<pack>/*.json and compiles packs/
```

Document ids are derived from names, so rebuilding keeps every UUID stable. Stop Foundry (or disable the module) before rebuilding, because Foundry locks the packs while the module is active.
