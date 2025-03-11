
/**
 * indicates the path to where the conversion worker module can be found
 */
const CONVERSION_WORKER_PATH = "./static/js/conversion_worker.mjs?v=6";

/**
 * Represents a level
 * @typedef {Object} GJGameLevel
 * @property {string} name
 * @property {string} description
 */

/**
 * Represents output of a level conversion
 * @typedef {Object} ConversionReport
 * @property {Object[]} removed_objects
 * @property {number} preconversion_object_count
 */

/**
 * global object that manages the loaded level's state
 */
export class Converter {
	/**
	 * current level being converted
	 * this is not the same as the python object! it is merely a js representation.
	 * @type {?GJGameLevel}
	 */
	static #current_level = null;

	/**
	 * worker object for the conversion engine
	 * do not reset
	 * @type {?Worker}
	 */
	static #engine_worker = null;

	/**
	 * global number of how many promises have been made
	 * @type {number}
	 */
	static #worker_promise_count = 0;

	/**
	 * global promise tracker for resolves
	 * @type {Object.<number, function(*): void>}
	 */
	static #worker_promises_resolve = {};

	/**
	 * global promise tracker for rejects
	 * @type {Object.<number, function(*): void>}
	 */
	static #worker_promises_reject = {};

	/**
	 * resets the converter state
	 */
	static async reset_level() {
		if (this.#engine_ready() && this.#current_level) {
			await this.#run_on_worker("reset_state");
		}

		this.#current_level = null;
	}

	/**
	 * decodes a string as base64, if it is encoded as base64
	 * @param data {string} the base64 encoded data
	 * @returns the decoded string, data if it was not encoded as base64
	 */
	static #base64_decode(data) {
		try {
			return atob(data);
		} catch(e) {
			// "The string to be decoded is not correctly encoded"
			if (e instanceof DOMException) {
				return data;
			}
			throw e;
		}
	}

	/**
	 * loads a level into the converter
	 * @param {string} text contents of level gmd
	 */
	static async on_load_level(text) {
		if (!this.#engine_ready()) {
			return;
		}

		const level_input = document.querySelector("#level-input-element");
		level_input.disabled = true;

		this.#current_level = await this.#run_on_worker("get_gmd_info", text);

		const gmd = this.#current_level;

		const level_name = document.querySelector("#level-name");
		level_name.innerText = gmd["name"];

		const level_description = document.querySelector("#level-description");
		if (gmd["description"]) {
			level_description.innerText = this.#base64_decode(gmd["description"]);
		} else {
			level_description.innerText = "No description provided."
		}

		level_input.classList.add("is-hidden");

		const info_element = document.querySelector("#level-info-element");
		info_element.classList.remove("is-hidden");
	}

	/**
	 * runs a conversion on the currently loaded level
	 * @param {string[]} groups names of groups to apply in conversion
	 */
	static async run_conversion(groups) {
		const report = await this.#run_on_worker("run_conversion", this.#current_level, groups);

		const gmd_data = await this.#run_on_worker("level_to_gmd", this.#current_level);

		const gmd_blob = new Blob([gmd_data], { type: "application/xml" });

		const download_button = document.querySelector("#download-gmd");
		download_button.href = window.URL.createObjectURL(gmd_blob);
		download_button.download = `${this.#current_level["name"]}.gmd`;

		await this.#parse_report(report)

		const report_element = document.querySelector("#conversion-report-element");
		report_element.classList.remove("is-hidden");

		const info_element = document.querySelector("#level-info-element");
		info_element.classList.add("is-hidden");
	}

	/**
	 * modifies the result info based on the conversion report
	 * @param {ConversionReport} report report from level conversion
	 */
	static async #parse_report(report) {
		const removed_element = document.querySelector("#count-removed");

		const removed_percentage = report.removed_objects.length * 100 / report.preconversion_object_count;
		removed_element.innerText = removed_percentage.toFixed(0);

		const report_output = await this.#run_on_worker("parse_reports", report);

		const report_element = document.querySelector("#conversion-report");
		report_element.innerText = report_output;
	}

	/**
	 * initializes the global Python engine
	 * @param {function(ErrorEvent)} on_error
	 * @returns {Promise<void>}
	 */
	static async initialize_engine(on_error, use_legacy_wheel_version = false) {
		const worker = new Worker(CONVERSION_WORKER_PATH, {
			type: "module",
		});

		worker.addEventListener("message", (event) => {
			const { promise_id, value, success } = event.data;

			if (success) {
				this.#worker_promises_resolve[promise_id](value);
			} else {
				this.#worker_promises_reject[promise_id](value);
			}
		});

		worker.addEventListener("error", (error) => {
			if (on_error) {
				on_error(error);
			}
		});

		this.#engine_worker = worker;
		
		// Use legacy wheel version if needed
		if (use_legacy_wheel_version) {
			this.#run_on_worker("set_level_converter_wheel", "gdlevelconverter-1.1.0-py3-none-any.whl");
		}

		return this.#run_on_worker("initialize_engine");
	}

	/**
	 * gets a list of all available conversion groups
	 * @returns {Promise<string[]>} all conversion groups by name
	 */
	static get_conversion_groups() {
		return this.#run_on_worker("get_conversion_groups");
	}

	/**
	 * gets list of groups in a metagroup
	 * @param {string} name name of metagroup
	 * @returns {Promise<string[]|undefined>} list of groups in metagroup
	 */
	static get_metagroup(name) {
		return this.#run_on_worker("get_metagroup", name);
	}

	/**
	 * gets current converter version
	 * @returns {Promise<string>} version of the converter engine
	 */
	static get_version() {
		return this.#run_on_worker("get_version");
	}

	static #engine_ready() {
		return this.#engine_worker != null;
	}

	/**
	 * runs a function on the engine worker
	 * @template Return
	 * @param {string} type name of function to run
	 * @param {...*} args parameters to call function with
	 * @returns {Promise<Return>}
	 */
	static #run_on_worker(type, ...args) {
		if (!this.#engine_worker) {
			throw new Error("run function called before engine is initialized");
		}

		const promise_id = this.#worker_promise_count++;
		const promise = new Promise((resolve, reject) => {
			this.#worker_promises_resolve[promise_id] = resolve;
			this.#worker_promises_reject[promise_id] = reject;
		});

		this.#engine_worker.postMessage({ type, promise_id, args });

		return promise;
	}
}
