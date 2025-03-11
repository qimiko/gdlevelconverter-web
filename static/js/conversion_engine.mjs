import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.mjs";

let LEVEL_CONVERTER_WHEEL = "gdlevelconverter-1.1.3-py3-none-any.whl";

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
 * @property {Iterable<Object>} removed_objects
 * @property {number} preconversion_object_count
 */

/**
 * global wrapper for the engine that powers the converter
 */
export class ConversionEngine {
	static #py_engine = null;

	static set_level_converter_wheel(wheel) {
		LEVEL_CONVERTER_WHEEL = wheel
	}

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

		console.log("loading pyodide with wheel", LEVEL_CONVERTER_WHEEL);

		const pyodide = await loadPyodide();

		// initial package setup
		await pyodide.loadPackage("micropip");
		await pyodide.runPythonAsync(`
		import micropip
		await micropip.install("../wheels/${LEVEL_CONVERTER_WHEEL}")
		`);

		// js to python functions
		await pyodide.runPython(`
		from gdlevelconverter.gjobjects import GJGameLevel
		from gdlevelconverter.conversion import ConversionOptions, GJGameObjectConversionGroupsByName, GJGameObjectConversionSubGroups
		from gdlevelconverter import command_line
		from importlib.metadata import version
		from pyodide.ffi import to_js
		import base64

		# this is really hacky imo but it's okay
		def get_gmd_info(lvl):
			return to_js(GJGameLevel.from_gmd(lvl))

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

		def parse_reports(report, verbose = False):
			return to_js(command_line.parse_reports(report))

		def get_conversion_groups():
			return to_js(GJGameObjectConversionGroupsByName.keys())

		def get_metagroup(name):
			metagroup = GJGameObjectConversionSubGroups.get(name, None)
			if not metagroup:
				return

			metagroup_names = [x.name for x in metagroup]

			return to_js(metagroup_names)

		def get_version():
			return to_js(version("gdlevelconverter"))
		`);

		this.#py_engine = pyodide;
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
	 * parses the conversion report into a human readable string
	 * @param {ConversionReport} report
	 * @returns {string} string containing all conversion reports together
	 */
	static parse_reports(report) {
		const py_parse_reports = this.#py_engine.runPython(`
			parse_reports
		`);

		const report_output = py_parse_reports(report, false);

		py_parse_reports.destroy();

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

		// this object is not really an array, so make it one
		return Array(...conversion_groups);
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

	/**
	 * gets current version of converter
	 * @returns {string} converter version string
	 */
	static get_version() {
		const py_get_version = this.#py_engine.runPython(`
			get_version
		`);

		const version = py_get_version();

		py_get_version.destroy();

		return version;
	}
}
