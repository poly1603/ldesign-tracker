/**
 * Less module declaration
 */
declare module 'less' {
  interface LessOptions {
    paths?: string[]
    filename?: string
    rootpath?: string
    compress?: boolean
    plugins?: any[]
    javascriptEnabled?: boolean
    modifyVars?: Record<string, string>
    math?: 'always' | 'strict' | 'parens' | 'parens-division'
    [key: string]: any
  }

  interface RenderOutput {
    css: string
    map?: string
    imports: string[]
  }

  function render(input: string, options?: LessOptions): Promise<RenderOutput>

  export default {
    render
  }
}
