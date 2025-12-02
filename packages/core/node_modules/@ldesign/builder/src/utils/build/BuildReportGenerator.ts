/**
 * 构建报告生成器
 * 
 * 生成详细的构建报告，包括性能分析、文件大小、依赖关系等
 * 
 * @author LDesign Team
 * @version 1.0.0
 */

import path from 'path'
import fs from 'fs-extra'
import { formatBytes, formatDuration } from '../misc/performance-utils'
import { Logger } from '../logger'

/**
 * 构建报告数据
 */
export interface BuildReportData {
  /** 构建时间戳 */
  timestamp: number
  /** 构建持续时间 (ms) */
  duration: number
  /** 构建状态 */
  status: 'success' | 'failed' | 'warning'
  /** 输出文件 */
  outputs: Array<{
    file: string
    size: number
    gzipSize?: number
    type: string
  }>
  /** 性能指标 */
  performance?: {
    phases: Array<{
      name: string
      duration: number
      percentage: number
    }>
    bottlenecks?: string[]
  }
  /** 内存使用 */
  memory?: {
    peak: number
    average: number
    final: number
  }
  /** 警告和错误 */
  issues?: Array<{
    type: 'error' | 'warning'
    message: string
    file?: string
    line?: number
  }>
  /** 依赖信息 */
  dependencies?: {
    total: number
    production: number
    development: number
  }
  /** 代码质量 */
  quality?: {
    score: number
    issues: number
  }
}

/**
 * 报告格式
 */
export type ReportFormat = 'json' | 'html' | 'markdown' | 'text'

/**
 * 报告选项
 */
export interface BuildReportOptions {
  /** 输出目录 */
  outputDir?: string
  /** 报告格式 */
  formats?: ReportFormat[]
  /** 是否包含详细信息 */
  detailed?: boolean
  /** 是否打开报告 */
  open?: boolean
}

/**
 * 构建报告生成器
 */
export class BuildReportGenerator {
  private logger: Logger
  private outputDir: string

  constructor(options: BuildReportOptions = {}) {
    this.logger = new Logger({ prefix: 'BuildReport' })
    this.outputDir = options.outputDir || path.join(process.cwd(), 'build-reports')
  }

  /**
   * 生成报告
   */
  async generate(
    data: BuildReportData,
    options: BuildReportOptions = {}
  ): Promise<string[]> {
    const formats = options.formats || ['json', 'html']
    const generatedFiles: string[] = []

    await fs.mkdir(this.outputDir, { recursive: true })

    for (const format of formats) {
      const filePath = await this.generateFormat(data, format, options)
      generatedFiles.push(filePath)
    }

    this.logger.info(`构建报告已生成: ${generatedFiles.join(', ')}`)
    return generatedFiles
  }

  /**
   * 生成指定格式的报告
   */
  private async generateFormat(
    data: BuildReportData,
    format: ReportFormat,
    options: BuildReportOptions
  ): Promise<string> {
    const timestamp = new Date(data.timestamp).toISOString().replace(/[:.]/g, '-')
    const fileName = `build-report-${timestamp}.${format}`
    const filePath = path.join(this.outputDir, fileName)

    let content: string

    switch (format) {
      case 'json':
        content = this.generateJSON(data, options)
        break
      case 'html':
        content = this.generateHTML(data, options)
        break
      case 'markdown':
        content = this.generateMarkdown(data, options)
        break
      case 'text':
        content = this.generateText(data, options)
        break
      default:
        throw new Error(`不支持的报告格式: ${format}`)
    }

    await fs.writeFile(filePath, content, 'utf-8')
    return filePath
  }

  /**
   * 生成 JSON 格式报告
   */
  private generateJSON(data: BuildReportData, options: BuildReportOptions): string {
    return JSON.stringify(data, null, options.detailed ? 2 : 0)
  }

  /**
   * 生成交互式 HTML 格式报告
   */
  private generateHTML(data: BuildReportData, options: BuildReportOptions): string {
    const statusColor = data.status === 'success' ? '#4caf50' : data.status === 'failed' ? '#f44336' : '#ff9800'
    const totalSize = data.outputs.reduce((sum, o) => sum + o.size, 0)
    const totalGzip = data.outputs.reduce((sum, o) => sum + (o.gzipSize || 0), 0)

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>构建报告 - ${new Date(data.timestamp).toLocaleString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f5f5f5; color: #333; }
    .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); overflow: hidden; }
    .header { padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .header h1 { font-size: 32px; margin-bottom: 12px; font-weight: 700; }
    .header p { opacity: 0.9; font-size: 14px; }
    .status { display: inline-block; padding: 8px 16px; background: ${statusColor}; border-radius: 6px; font-weight: 600; margin-top: 15px; }
    .tabs { display: flex; border-bottom: 2px solid #eee; background: #fafafa; padding: 0 30px; }
    .tab { padding: 15px 25px; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; font-weight: 500; }
    .tab:hover { background: #f0f0f0; }
    .tab.active { border-bottom-color: #667eea; color: #667eea; background: white; }
    .tab-content { display: none; padding: 30px; }
    .tab-content.active { display: block; }
    .section { margin-bottom: 30px; }
    .section h2 { font-size: 22px; margin-bottom: 20px; color: #333; font-weight: 600; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .metric-card { padding: 20px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .metric-value { font-size: 28px; font-weight: 700; color: #333; }
    .metric-sub { font-size: 14px; color: #888; margin-top: 5px; }
    .chart-container { height: 300px; margin: 20px 0; position: relative; }
    .file-list { list-style: none; }
    .file-item { padding: 15px; margin: 8px 0; background: #f9f9f9; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; }
    .file-item:hover { background: #f0f0f0; transform: translateX(5px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .file-name { font-family: 'Monaco', 'Menlo', monospace; color: #667eea; font-size: 14px; }
    .file-info { display: flex; gap: 20px; align-items: center; }
    .file-size { color: #666; font-size: 14px; }
    .file-badge { padding: 4px 8px; background: #e0e7ff; color: #667eea; border-radius: 4px; font-size: 11px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 14px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #555; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { font-size: 14px; }
    .progress-bar { height: 24px; background: #e0e0e0; border-radius: 12px; overflow: hidden; position: relative; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
    .progress-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 11px; font-weight: 600; color: #333; }
    .pie-chart { width: 300px; height: 300px; margin: 0 auto; }
    .size-comparison { display: flex; gap: 10px; align-items: center; margin: 10px 0; }
    .size-bar { flex: 1; height: 30px; background: #e0e0e0; border-radius: 4px; overflow: hidden; display: flex; }
    .size-segment { display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600; transition: all 0.3s; }
    .size-segment:hover { opacity: 0.8; }
    .tooltip { position: relative; cursor: help; }
    .tooltip:hover::after { content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); padding: 8px 12px; background: #333; color: white; font-size: 12px; border-radius: 4px; white-space: nowrap; margin-bottom: 5px; z-index: 1000; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 构建报告</h1>
      <p>${new Date(data.timestamp).toLocaleString()}</p>
      <p class="status">${data.status.toUpperCase()}</p>
    </div>

    <!-- 标签页导航 -->
    <div class="tabs">
      <div class="tab active" onclick="switchTab('overview')">📊 概览</div>
      <div class="tab" onclick="switchTab('files')">📦 文件</div>
      <div class="tab" onclick="switchTab('performance')">⚡ 性能</div>
      ${data.issues && data.issues.length > 0 ? `<div class="tab" onclick="switchTab('issues')">⚠️ 问题</div>` : ''}
    </div>

    <!-- 概览标签页 -->
    <div id="overview" class="tab-content active">
      <div class="section">
        <h2>📊 构建概览</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">构建时间</div>
            <div class="metric-value">${formatDuration(data.duration)}</div>
            <div class="metric-sub">平均速度: ${(data.outputs.length / (data.duration / 1000)).toFixed(2)} 文件/秒</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">输出文件</div>
            <div class="metric-value">${data.outputs.length}</div>
            <div class="metric-sub">多格式输出</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">原始大小</div>
            <div class="metric-value">${formatBytes(totalSize)}</div>
            <div class="metric-sub">${(totalSize / 1024).toFixed(2)} KB</div>
          </div>
          ${totalGzip > 0 ? `
          <div class="metric-card">
            <div class="metric-label">Gzip 大小</div>
            <div class="metric-value">${formatBytes(totalGzip)}</div>
            <div class="metric-sub">压缩率: ${((1 - totalGzip / totalSize) * 100).toFixed(1)}%</div>
          </div>
          ` : ''}
          ${data.memory ? `
          <div class="metric-card">
            <div class="metric-label">峰值内存</div>
            <div class="metric-value">${formatBytes(data.memory.peak)}</div>
            <div class="metric-sub">平均: ${formatBytes(data.memory.average)}</div>
          </div>
          ` : ''}
        </div>

        <!-- 大小对比图表 -->
        <div class="section">
          <h2>📈 大小对比</h2>
          <div class="chart-container">
            <canvas id="sizeChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- 文件标签页 -->
    <div id="files" class="tab-content">
      <div class="section">
        <h2>📦 输出文件详情</h2>
        <table>
          <thead>
            <tr>
              <th>文件名</th>
              <th>类型</th>
              <th>原始大小</th>
              <th>Gzip 大小</th>
              <th>压缩率</th>
            </tr>
          </thead>
          <tbody>
            ${data.outputs.map(output => {
      const compressionRatio = output.gzipSize
        ? ((1 - output.gzipSize / output.size) * 100).toFixed(1) + '%'
        : '-'
      const fileType = output.file.endsWith('.d.ts') ? 'DTS' :
        output.file.endsWith('.js') ? 'JS' :
          output.file.endsWith('.css') ? 'CSS' : 'Other'
      return `
                <tr>
                  <td><span class="file-name">${output.file}</span></td>
                  <td><span class="file-badge">${fileType}</span></td>
                  <td>${formatBytes(output.size)}</td>
                  <td>${output.gzipSize ? formatBytes(output.gzipSize) : '-'}</td>
                  <td>${compressionRatio}</td>
                </tr>
              `
    }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 性能标签页 -->
    <div id="performance" class="tab-content">
      ${data.performance ? `
      <div class="section">
        <h2>⚡ 性能分析</h2>
        <div class="chart-container">
          <canvas id="performanceChart"></canvas>
        </div>
        <table>
          <thead>
            <tr>
              <th>阶段</th>
              <th>耗时</th>
              <th>占比</th>
              <th>进度</th>
            </tr>
          </thead>
          <tbody>
            ${data.performance.phases.map(phase => `
              <tr>
                <td>${phase.name}</td>
                <td>${formatDuration(phase.duration)}</td>
                <td>${phase.percentage.toFixed(1)}%</td>
                <td>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${phase.percentage}%"></div>
                    <div class="progress-text">${phase.percentage.toFixed(1)}%</div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : '<p>暂无性能数据</p>'}
    </div>

    <!-- 问题标签页 -->
    ${data.issues && data.issues.length > 0 ? `
    <div id="issues" class="tab-content">
      <div class="section">
        <h2>⚠️ 问题列表 (${data.issues.length})</h2>
        <ul class="file-list">
          ${data.issues.map(issue => `
            <li class="file-item">
              <div>
                <span>${issue.type === 'error' ? '❌' : '⚠️'} ${issue.message}</span>
                ${issue.file ? `<div class="file-name" style="margin-top: 5px">${issue.file}${issue.line ? `:${issue.line}` : ''}</div>` : ''}
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
    ` : ''}
  </div>

  <script>
    // 标签页切换
    function switchTab(tabName) {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    }

    // 大小对比图表
    const sizeData = ${JSON.stringify(data.outputs.map(o => ({
      label: o.file,
      raw: o.size,
      gzip: o.gzipSize || 0
    })))};

    const sizeChartCtx = document.getElementById('sizeChart');
    if (sizeChartCtx) {
      new Chart(sizeChartCtx, {
        type: 'bar',
        data: {
          labels: sizeData.map(d => d.label),
          datasets: [
            {
              label: '原始大小',
              data: sizeData.map(d => d.raw / 1024), // KB
              backgroundColor: 'rgba(102, 126, 234, 0.7)',
              borderColor: 'rgba(102, 126, 234, 1)',
              borderWidth: 1
            },
            {
              label: 'Gzip 大小',
              data: sizeData.map(d => d.gzip / 1024), // KB
              backgroundColor: 'rgba(118, 75, 162, 0.7)',
              borderColor: 'rgba(118, 75, 162, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: '文件大小对比 (KB)'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'KB'
              }
            }
          }
        }
      });
    }

    // 性能图表
    ${data.performance ? `
    const perfData = ${JSON.stringify(data.performance.phases)};
    const perfChartCtx = document.getElementById('performanceChart');
    if (perfChartCtx) {
      new Chart(perfChartCtx, {
        type: 'pie',
        data: {
          labels: perfData.map(p => p.name),
          datasets: [{
            data: perfData.map(p => p.duration),
            backgroundColor: [
              'rgba(102, 126, 234, 0.8)',
              'rgba(118, 75, 162, 0.8)',
              'rgba(76, 175, 80, 0.8)',
              'rgba(255, 152, 0, 0.8)',
              'rgba(244, 67, 54, 0.8)'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: '构建阶段耗时分布'
            },
            legend: {
              position: 'right'
            }
          }
        }
      });
    }
    ` : ''}
  </script>
</body>
</html>`
  }

  /**
   * 生成 Markdown 格式报告
   */
  private generateMarkdown(data: BuildReportData, _options: BuildReportOptions): string {
    const totalSize = data.outputs.reduce((sum, o) => sum + o.size, 0)

    let md = `# 构建报告\n\n`
    md += `**时间**: ${new Date(data.timestamp).toLocaleString()}\n`
    md += `**状态**: ${data.status}\n`
    md += `**耗时**: ${formatDuration(data.duration)}\n\n`

    md += `## 构建概览\n\n`
    md += `- 输出文件: ${data.outputs.length}\n`
    md += `- 总大小: ${formatBytes(totalSize)}\n`
    if (data.memory) {
      md += `- 峰值内存: ${formatBytes(data.memory.peak)}\n`
    }
    md += `\n`

    md += `## 输出文件\n\n`
    md += `| 文件 | 大小 | Gzip |\n`
    md += `|------|------|------|\n`
    data.outputs.forEach(output => {
      md += `| ${output.file} | ${formatBytes(output.size)} | ${output.gzipSize ? formatBytes(output.gzipSize) : '-'} |\n`
    })

    return md
  }

  /**
   * 生成纯文本格式报告
   */
  private generateText(data: BuildReportData, _options: BuildReportOptions): string {
    const totalSize = data.outputs.reduce((sum, o) => sum + o.size, 0)

    let text = `构建报告\n${'='.repeat(50)}\n\n`
    text += `时间: ${new Date(data.timestamp).toLocaleString()}\n`
    text += `状态: ${data.status}\n`
    text += `耗时: ${formatDuration(data.duration)}\n\n`

    text += `输出文件 (${data.outputs.length}):\n`
    data.outputs.forEach(output => {
      text += `  - ${output.file}: ${formatBytes(output.size)}\n`
    })
    text += `\n总大小: ${formatBytes(totalSize)}\n`

    return text
  }
}

/**
 * 创建构建报告生成器
 */
export function createBuildReportGenerator(
  options?: BuildReportOptions
): BuildReportGenerator {
  return new BuildReportGenerator(options)
}

