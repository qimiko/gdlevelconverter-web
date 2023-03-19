class Conversion {
	static #py_engine;
	static #current_level;

	static set_py_engine(engine) {
		Conversion.#py_engine = engine;
	}

	static reset_level() {
		if (this.#current_level) {
			this.#current_level.destroy();
			this.#current_level = null;
		}

		hide_error();
	}

	static on_load_level(text) {
		if (!Conversion.#py_engine) {
			return;
		}

		hide_error();

		const level_input = document.querySelector("#level-input-element");
		level_input.disabled = true;

		const py_get_gmd_info = Conversion.#py_engine.runPython(`
			get_gmd_info
		`);

		try {
			this.#current_level = py_get_gmd_info(text);
		} catch (e) {
			py_get_gmd_info.destroy();
			display_error("level parse", e);
			return;
		}

		const gmd = this.#current_level.toJs();

		py_get_gmd_info.destroy();

		const level_name = document.querySelector("#level-name");
		level_name.innerText = gmd["name"];

		const level_description = document.querySelector("#level-description");
		if (gmd["description"]) {
			const py_b64_decode = Conversion.#py_engine.runPython(`
				b64_decode
			`);

			level_description.innerText = py_b64_decode(gmd["description"]);

			py_b64_decode.destroy();
		} else {
			level_description.innerText = "No description provided."
		}

		level_input.classList.add("is-hidden");

		const info_element = document.querySelector("#level-info-element");
		info_element.classList.remove("is-hidden");
	}

	static run_conversion(groups) {
		const py_run_conversion = Conversion.#py_engine.runPython(`
			run_conversion
		`);

		const report = py_run_conversion(Conversion.#current_level, groups);

		py_run_conversion.destroy();

		const gmd_data = Conversion.#current_level.to_gmd()

		const gmd_blob = new Blob([gmd_data], { type: "application/xml" });

		const download_button = document.querySelector("#download-gmd");
		download_button.href = window.URL.createObjectURL(gmd_blob);
		download_button.download = `${Conversion.#current_level["name"]}.gmd`;

		this.#parse_report(report)

		const report_element = document.querySelector("#conversion-report-element");
		report_element.classList.remove("is-hidden");

		const info_element = document.querySelector("#level-info-element");
		info_element.classList.add("is-hidden");
	}

	static #parse_report(report) {
		const removed_element = document.querySelector("#count-removed");

		const removed_percentage = report.removed_objects.length * 100 / report.preconversion_object_count;
		removed_element.innerText = removed_percentage.toFixed(0);

		const py_parse_group_conversion = Conversion.#py_engine.runPython(`
			parse_group_conversion
		`);

		const py_parse_removed_report = Conversion.#py_engine.runPython(`
			parse_removed_report
		`);

		const report_output = py_parse_group_conversion(report) + py_parse_removed_report(report);

		const report_element = document.querySelector("#conversion-report");
		report_element.innerText = report_output;

		py_parse_group_conversion.destroy();
		py_parse_removed_report.destroy();
	}
}

const level_input_box = document.querySelector("#level-input-box");
level_input_box.addEventListener("dragenter", (event) => {
	event.stopPropagation();
	event.preventDefault();
}, false);
level_input_box.addEventListener("dragover", (event) => {
	event.stopPropagation();
	event.preventDefault();
}, false);
level_input_box.addEventListener("drop", (event) => {
	event.stopPropagation();
	event.preventDefault();

	const data_transfer = event.dataTransfer;
	const file = data_transfer.files[0];

	if (file) {
		on_file_input(file);
	}
}, false);

const error_block = document.querySelector("#error-block");
const error_title = document.querySelector("#error-title");
const error_code = document.querySelector("#error-code");
function display_error(section_title, body) {
	error_block.classList.remove("is-hidden");
	error_title.innerText = `Error reached during ${section_title}:`;

	if (body) {
		error_code.innerText = body;
	}
}

function hide_error() {
	error_block.classList.add("is-hidden");
}

const level_input_element = document.querySelector("#level-file-input");
level_input_element.addEventListener("change", () => {
	const input_file = level_input_element.files[0];

	if (input_file) {
		on_file_input(input_file);
	}
}, false);

function on_file_input(file) {
	const reader = new FileReader();
	reader.addEventListener("load", (event) => {
		Conversion.on_load_level(event.target.result);
	});

	reader.readAsText(file);
}

const active_groups_select = document.querySelector("#active-groups-select");
active_groups_select.addEventListener("change", () => {
	const metagroup_select = document.querySelector("#metagroup-select");
	metagroup_select.value = "custom";
}, false);

const select_new_button = document.querySelector("#choose-new");
select_new_button.addEventListener("click", () => {
	const level_input = document.querySelector("#level-input-element");
	level_input.classList.remove("is-hidden");
	level_input_element.value = null;
	level_input.disabled = false;

	const info_element = document.querySelector("#level-info-element");
	info_element.classList.add("is-hidden");

	Conversion.reset_level();
}, false);

const run_convert_button = document.querySelector("#convert-level");
run_convert_button.addEventListener("click", (event) => {
	event.target.disabled = true;

	const groups = Array.from(active_groups_select.selectedOptions).map(v => v.value);

	Conversion.run_conversion(groups);
});

const another_button = document.querySelector("#another-level");
another_button.addEventListener("click", () => {
	const level_input = document.querySelector("#level-input-element");
	level_input.classList.remove("is-hidden");
	level_input_element.value = null;
	level_input.disabled = false;

	const report_element = document.querySelector("#conversion-report-element");
	report_element.classList.add("is-hidden");

	Conversion.reset_level();
}, false);
