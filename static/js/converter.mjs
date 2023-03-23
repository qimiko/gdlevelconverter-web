import { ConversionEngine } from "./conversion_engine.mjs";

/**
 * @typedef { import("./conversion_engine.mjs").GJGameLevel } GJGameLevel
 * @typedef { import("./conversion_engine.mjs").ConversionReport } ConversionReport
 */

/**
 * global object that manages the loaded level's state
 */
export class Converter {
	/**
	 * current level being converted
	 * @type {?GJGameLevel}
	 */
	static #current_level = null;

	/**
	 * resets the converter state
	 */
	static reset_level() {
		this.#current_level = null;
	}

	/**
	 * loads a level into the converter
	 * @param {string} text contents of level gmd
	 */
	static on_load_level(text) {
		if (!ConversionEngine.engine_ready()) {
			return;
		}

		const level_input = document.querySelector("#level-input-element");
		level_input.disabled = true;

		this.#current_level = ConversionEngine.get_gmd_info(text);

		const gmd = this.#current_level;

		const level_name = document.querySelector("#level-name");
		level_name.innerText = gmd["name"];

		const level_description = document.querySelector("#level-description");
		if (gmd["description"]) {
			level_description.innerText = ConversionEngine.base64_decode(gmd["description"]);
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
	static run_conversion(groups) {
		const report = ConversionEngine.run_conversion(this.#current_level, groups);

		const gmd_data = this.#current_level.to_gmd()

		const gmd_blob = new Blob([gmd_data], { type: "application/xml" });

		const download_button = document.querySelector("#download-gmd");
		download_button.href = window.URL.createObjectURL(gmd_blob);
		download_button.download = `${this.#current_level["name"]}.gmd`;

		this.#parse_report(report)

		const report_element = document.querySelector("#conversion-report-element");
		report_element.classList.remove("is-hidden");

		const info_element = document.querySelector("#level-info-element");
		info_element.classList.add("is-hidden");
	}

	/**
	 * modifies the result info based on the conversion report
	 * @param {ConversionReport} report report from level conversion
	 */
	static #parse_report(report) {
		const removed_element = document.querySelector("#count-removed");

		const removed_percentage = report.removed_objects.length * 100 / report.preconversion_object_count;
		removed_element.innerText = removed_percentage.toFixed(0);

		const report_output = ConversionEngine.parse_group_conversion(report) + ConversionEngine.parse_removed_report(report);

		const report_element = document.querySelector("#conversion-report");
		report_element.innerText = report_output;
	}
}
