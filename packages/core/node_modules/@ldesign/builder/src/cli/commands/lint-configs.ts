/**
 * Lint Configs Command
 * CLI command to validate all package configurations
 */

import { Command } from 'commander'
import { lintConfigs } from '../../utils/misc/ConfigLinter'

export function registerLintConfigsCommand(program: Command): void {
  program
    .command('lint-configs')
    .description('Validate all package configurations in the monorepo')
    .option('-p, --pattern <pattern>', 'Glob pattern for config files', 'packages/*/ldesign.config.ts')
    .option('-r, --root <root>', 'Root directory of the monorepo', process.cwd())
    .action(async (options) => {
      await lintConfigs(options.pattern, options.root)
    })
}


