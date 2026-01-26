import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import MysqlWorker from 'monaco-sql-languages/esm/languages/mysql/mysql.worker?worker'
import PgsqlWorker from 'monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker'

globalThis.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new JsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new CssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new HtmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new TsWorker()
    }
    // SQL Workers (Critical for monaco-sql-languages validation)
    if (label === 'mysql') {
      return new MysqlWorker()
    }
    if (label === 'pgsql' || label === 'postgres') {
      return new PgsqlWorker()
    }
    return new EditorWorker()
  },
}
