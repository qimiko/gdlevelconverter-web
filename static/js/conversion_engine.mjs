import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.22.1/full/pyodide.mjs";

/**
 * Represents a level
 * @typedef {Object} GJGameLevel
 * @property {string} name
 * @property {string} description
 * @property {function(): string} to_gmd
 */

/**
 * Represents output of a level conversion
 * @typedef {Object} ConversionReport
 * @property {Object[]} removed_objects
 * @property {number} preconversion_object_count
 */

/**
 * global wrapper for the engine that powers the converter
 */
export class ConversionEngine {
	static #py_engine = null;

	/**
	 * checks if the engine is finished loading
	 * @returns {boolean} true if engine is initialized
	 */
	static engine_ready() {
		return this.#py_engine != null;
	}

	/**
	 * initializes the global Python engine
	 * @returns {Promise<void>}
	 */
	static async initialize_engine() {
		if (this.engine_ready()) {
			return;
		}

		const pyodide = await loadPyodide();

		// initial package setup
		await pyodide.loadPackage("micropip");
		await pyodide.runPythonAsync(`
		import micropip
		await micropip.install("./static/wheels/gdlevelconverter-1.0.4-py3-none-any.whl")
		`);

		// js to python functions
		await pyodide.runPython(`
		from gdlevelconverter.gjobjects import GJGameLevel
		from gdlevelconverter.conversion import ConversionOptions, GJGameObjectConversionGroupsByName, GJGameObjectConversionSubGroups
		from gdlevelconverter import command_line
		from pyodide.ffi import to_js
		import base64

		# this is really hacky imo but it's okay
		def get_gmd_info(lvl):
			return to_js(GJGameLevel.from_gmd(lvl))

		# atob is not very good lol
		def b64_decode(str):
			return to_js(base64.urlsafe_b64decode(str).decode())

		def run_conversion(level, groups_str):
			groups = []

			for group in groups_str:
					if group in GJGameObjectConversionGroupsByName:
							groups.append(GJGameObjectConversionGroupsByName[group])

			# as of right now the target version is hardcoded
			conversion_report = level.level_string.to_legacy_format(
					ConversionOptions(
							groups=groups,
							maximum_id=744
					)
			)
			level.binary_version = 24

			return to_js(conversion_report)

		def parse_group_conversion(report):
			return to_js(command_line.parse_group_conversion(report))

		def parse_removed_report(report):
			return to_js(command_line.parse_removed_report(report))

		def get_conversion_groups():
			return to_js(GJGameObjectConversionGroupsByName.keys())

		def get_metagroup(name):
			metagroup = GJGameObjectConversionSubGroups.get(name, None)
			if not metagroup:
				return

			metagroup_names = [x.name for x in metagroup]

			return to_js(metagroup_names)
		`);

		this.#py_engine = pyodide;
	}

	/**
	 * runs a base64 decode on the provided string
	 * @param {string} text base64 encoded text
	 * @returns {string} base64 decoded string
	 */
	static base64_decode(text) {
		const py_b64_decode = this.#py_engine.runPython(`
			b64_decode
		`);

		const decoded = py_b64_decode(text);

		py_b64_decode.destroy();

		return decoded;
	}

	/**
	 * parses a gmd file into a level
	 * @param {string} lvl text of gmd file
	 * @returns {GJGameLevel} parsed level info
	 */
	static get_gmd_info(lvl) {
		const py_get_gmd_info = this.#py_engine.runPython(`
			get_gmd_info
		`);

		let gmd = null;

		try {
			gmd = py_get_gmd_info(lvl);
		} catch (e) {
			// rethrow error, but destroy the function proxy first
			py_get_gmd_info.destroy();
			throw e;
		}

		py_get_gmd_info.destroy();

		return gmd;
	}

	/**
	 * runs a level conversion on the provided level
	 * @param {GJGameLevel} level level object to convert
	 * @param {string[]} groups array of groups to use in conversion
	 * @returns {ConversionReport} detailed report of conversion results
	 */
	static run_conversion(level, groups) {
		const py_run_conversion = this.#py_engine.runPython(`
			run_conversion
		`);

		const report = py_run_conversion(level, groups);

		py_run_conversion.destroy();

		return report;
	}

	/**
	 * reads the converted objects by group from a conversion report
	 * @param {ConversionReport} report
	 * @returns {string} string naming converted objects
	 */
	static parse_group_conversion(report) {
		const py_parse_group_conversion = this.#py_engine.runPython(`
			parse_group_conversion
		`);

		const report_output = py_parse_group_conversion(report);

		py_parse_group_conversion.destroy();

		return report_output;
	}

	/**
	 * reads the removed objects from a conversion report
	 * @param {ConversionReport} report
	 * @returns {string} string naming removed objects
	 */
	static parse_removed_report(report) {
		const py_parse_removed_report = this.#py_engine.runPython(`
			parse_removed_report
		`);

		const report_output = py_parse_removed_report(report);

		py_parse_removed_report.destroy();

		return report_output;
	}

	/**
	 * gets a list of all available conversion groups
	 * @returns {string[]} all conversion groups by name
	 */
	static get_conversion_groups() {
		const py_get_conversion_groups = this.#py_engine.runPython(`
			get_conversion_groups
		`);

		const conversion_groups = py_get_conversion_groups();

		py_get_conversion_groups.destroy();

		return conversion_groups;
	}

	/**
	 * gets list of groups in a metagroup
	 * @param {string} name name of metagroup
	 * @returns {string[]|undefined} list of groups in metagroup
	 */
	static get_metagroup(name) {
		const py_get_metagroup = this.#py_engine.runPython(`
			get_metagroup
		`);

		const metagroup = py_get_metagroup(name);

		py_get_metagroup.destroy();

		return metagroup;
	}
}
