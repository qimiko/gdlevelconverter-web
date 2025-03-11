import { Converter } from "./converter.mjs?v=5";

const error_block = document.querySelector("#error-block");
const error_title = document.querySelector("#error-title");
const error_code = document.querySelector("#error-code");

/**
 * sets state to error section and displays a current error
 * @param {string} section_title current point of code where error originated
 * @param {ErrorEvent|Error|string} body detailed error to display
 */
function display_error(section_title, body) {
	error_block.classList.remove("is-hidden");
	error_title.innerText = `Error reached during ${section_title}:`;

	console.error(body);

	if (body instanceof ErrorEvent) {
		error_code.innerText = `${body.message}\nat: ${body.filename}:${body.lineno}:${body.colno}`;

		return;
	}

	if ((body instanceof Error && "stack" in body) || "_firefox_workaround_why_is_this_an_issue" in body) {
		// some stacks are formatted, browser dependent behavior...
		if (body.stack.includes("Error:")) {
			error_code.innerText = body.stack;
		} else {
			const stack_formatted = body.stack.split("\n").map(l => "  at " + l).join("\n");
			error_code.innerText = `${body.name}: ${body.message}\n${stack_formatted}`;
		}

		return;
	}

	error_code.innerText = body;
}

function hide_error() {
	error_block.classList.add("is-hidden");
}

function on_file_input(file) {
	const reader = new FileReader();
	const loading_label = document.querySelector("#level-loading-label");
	const level_input = document.querySelector("#level-file-input");

	reader.addEventListener("load", async (event) => {
		try {
			await Converter.on_load_level(event.target.result);
		} catch(e) {
			display_error("level parse", e);
			return;
		} finally {
			loading_label.classList.add("is-hidden");
			level_input.disabled = false;
		}
	});

	reader.readAsText(file);

	hide_error();
	loading_label.classList.remove("is-hidden");
	level_input.disabled = true;
}

async function select_metagroup(name) {
	const group_select = document.querySelector("#active-groups-select");
	if (name == "none") {
		for (const option of group_select.children) {
			option.selected = false;
		}
	}

	const metagroup = await Converter.get_metagroup(name);
	if (!metagroup) {
		return;
	}

	for (const option of group_select.children) {
		option.selected = metagroup.includes(option.value);
	}
}

async function reset_state() {
	const info_element = document.querySelector("#level-info-element");
	info_element.classList.add("is-hidden");

	const report_element = document.querySelector("#conversion-report-element");
	report_element.classList.add("is-hidden");

	// reset loading labels
	document.querySelector("#level-loading-label").classList.add("is-hidden");
	document.querySelector("#level-converting-label").classList.add("is-hidden");

	const level_input = document.querySelector("#level-input-element");
	level_input.classList.remove("is-hidden");
	level_input_element.value = null;

	const level_select = document.querySelector("#level-file-input");
	level_select.disabled = false;

	// reset conversion level select
	const base_selector = document.querySelector("#conversion-level-select[value='base']");
	base_selector.checked = true;

	document.querySelector("#group-select-advanced").classList.add("is-hidden");
	document.querySelector("#metagroup-select").value = "base";

	await select_metagroup("base");

	hide_error();
	await Converter.reset_level();
}

const metagroup_select = document.querySelector("#metagroup-select");
metagroup_select.addEventListener("change", async (event) => {
	await select_metagroup(event.target.value);
});

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

	// disable drag and drop if input is disabled
	const level_input = document.querySelector("#level-file-input");
	if (level_input.disabled) {
		return;
	}

	const data_transfer = event.dataTransfer;
	const file = data_transfer.files[0];

	if (file) {
		on_file_input(file);
	}
}, false);

const level_input_element = document.querySelector("#level-file-input");
level_input_element.addEventListener("change", () => {
	const input_file = level_input_element.files[0];

	if (input_file) {
		on_file_input(input_file);
	}
}, false);

const active_groups_select = document.querySelector("#active-groups-select");
active_groups_select.addEventListener("change", () => {
	const metagroup_select = document.querySelector("#metagroup-select");
	metagroup_select.value = "custom";
}, false);

document.querySelector("#restart-select").addEventListener("click", async () => {
	await reset_state();
}, false);

document.querySelector("#choose-new").addEventListener("click", async () => {
	await reset_state();
}, false);

document.querySelector("#reset-error").addEventListener("click", async () => {
	await reset_state();
}, false);

const run_convert_button = document.querySelector("#convert-level");
run_convert_button.addEventListener("click", async (event) => {
	event.target.disabled = true;

	const groups = Array.from(active_groups_select.selectedOptions).map(v => v.value);

	const converting_label = document.querySelector("#level-converting-label");
	converting_label.classList.remove("is-hidden");

	const conversion_options = document.querySelector("#conversion-options");
	conversion_options.disabled = true;

	try {
		await Converter.run_conversion(groups);
	} catch (e) {
		display_error("level conversion", e);
		return;
	} finally {
		conversion_options.disabled = false;
		event.target.disabled = false;
		converting_label.classList.add("is-hidden");
	}
});

document.querySelectorAll("#conversion-level-select").forEach((e) => {
	e.addEventListener("change", async (event) => {
		// show/hide group select if custom select is chosen
		if (event.target.value != "custom") {
			document.querySelector("#group-select-advanced").classList.add("is-hidden");
		} else {
			document.querySelector("#group-select-advanced").classList.remove("is-hidden");
		}

		// sync metagroup selection with conversion selection
		document.querySelector("#metagroup-select").value = event.target.value;

		await select_metagroup(event.target.value);
	});
});

if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("/gdlevelconverter-web/service_worker.js");
}

/**
 * displays an error from the web worker
 * @param {ErrorEvent} e error
 */
function display_worker_error(e) {
	display_error("unknown worker action", e);
}

async function main() {
	/**
	 * Look if must use legacy level converter wheel version (for compatibility with 2.1 gmd files)
	 */
	let use_legacy_wheel_version = false;
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.has("ce_legacy")) {
		use_legacy_wheel_version = true;

		// Change legacy-ce-version-element in footer to normal version redirect
		const legacy_ce_version_element = document.querySelector("#legacy-ce-version-element");
		legacy_ce_version_element.innerHTML = "<p>Using legacy version. Click <a href=\"https://qimiko.github.io/gdlevelconverter-web/\">here</a> to change to normal version.</p>";
	}

	try {
		await Converter.initialize_engine(display_worker_error, use_legacy_wheel_version);
	} catch (e) {
		display_error("loading engine", e);
		return;
	}

	try {
		const version_tag = document.querySelector("#converter-version");
		const version = await Converter.get_version();
		version_tag.innerText = `v${version}`;
	} catch (e) {
		// ignore any error here
	}

	const load_label = document.querySelector("#converter-loading-label");
	load_label.classList.add("is-hidden");

	const file_select = document.querySelector("#level-input-element");
	file_select.classList.remove("is-hidden");

	const file_input = document.querySelector("#level-file-input");
	file_input.disabled = false;

	const group_select = document.querySelector("#active-groups-select");
	group_select.innerHTML = "";

	const conversion_groups = await Converter.get_conversion_groups();

	for (const group of conversion_groups) {
		const option = document.createElement("option");
		option.value = group;
		option.innerText = group;

		group_select.appendChild(option);
	}

	group_select.disabled = false;

	await select_metagroup("base");
}

main();
