import { Converter } from "./converter.mjs";

const error_block = document.querySelector("#error-block");
const error_title = document.querySelector("#error-title");
const error_code = document.querySelector("#error-code");
function display_error(section_title, body) {
	error_block.classList.remove("is-hidden");
	error_title.innerText = `Error reached during ${section_title}:`;

	console.error(body);

	if (body instanceof Error && "stack" in body) {
		error_code.innerText = body.stack;
		return;
	}

	error_code.innerText = body;
}

function hide_error() {
	error_block.classList.add("is-hidden");
}

function on_file_input(file) {
	const reader = new FileReader();
	reader.addEventListener("load", async (event) => {
		hide_error();

		try {
			await Converter.on_load_level(event.target.result);
		} catch(e) {
			display_error("level parse", e);
			return;
		}
	});

	reader.readAsText(file);
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

const select_new_button = document.querySelector("#choose-new");
select_new_button.addEventListener("click", async () => {
	const level_input = document.querySelector("#level-input-element");
	level_input.classList.remove("is-hidden");
	level_input_element.value = null;
	level_input.disabled = false;

	const info_element = document.querySelector("#level-info-element");
	info_element.classList.add("is-hidden");

	// todo: make this a function and reset groups
	hide_error();
	await Converter.reset_level();
}, false);

const run_convert_button = document.querySelector("#convert-level");
run_convert_button.addEventListener("click", async (event) => {
	event.target.disabled = true;

	const groups = Array.from(active_groups_select.selectedOptions).map(v => v.value);

	try {
		await Converter.run_conversion(groups);
	} catch (e) {
		display_error("level conversion", e);
		return;
	}
});

const another_button = document.querySelector("#another-level");
another_button.addEventListener("click", async () => {
	const level_input = document.querySelector("#level-input-element");
	level_input.classList.remove("is-hidden");
	level_input_element.value = null;
	level_input.disabled = false;

	const report_element = document.querySelector("#conversion-report-element");
	report_element.classList.add("is-hidden");

	hide_error();
	await Converter.reset_level();
}, false);

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

async function main() {
	await Converter.initialize_engine();

	const loadLabel = document.querySelector("#converter-loading-label");
	loadLabel.classList.add("is-hidden");

	const fileInput = document.querySelector("#level-file-input");
	fileInput.disabled = false;

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
